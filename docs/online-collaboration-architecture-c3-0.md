# C3.0 - Online Collaboration Architecture

Phase C3.0 là decision/design-only cho iChess Center OS. Tài liệu này chốt hướng kiến trúc để C3.1/C3.2 triển khai sau, chưa triển khai realtime code, chưa chạy SQL, chưa apply SQL patch, chưa sửa dữ liệu local/cloud, và chưa tạo production center thật.

## 1. Executive summary

iChess Center OS hiện là app vận hành cơ sở chạy tốt trên localStorage, đã có nền Supabase Auth, `center_members`, `center_cloud_entities`, Cloud DB C2/C2.3 và các dry-run F19H.2 cho attendance/TKB/Học phí. C3 chuyển mục tiêu từ "một máy vận hành có backup cloud thủ công" sang "nhiều người cùng làm trên dữ liệu cloud có phân quyền, realtime, multi-center và môi trường staging/production rõ ràng".

Quyết định C3.0:

- Supabase Cloud là source of truth online theo `centerId`; localStorage là cache/offline fallback có backup và dirty queue.
- Auth dùng Supabase Auth; quyền ứng dụng đọc từ `center_members`/membership theo cơ sở, không đọc `auth.users` từ frontend.
- Alpha tiếp tục dùng `center_cloud_entities` cho các entity đã được F19H.2 thiết kế/dry-run, rồi chỉ tách bảng riêng khi cần query/RLS sâu.
- Realtime chỉ được bật theo entity/module sau khi có readiness gate, RLS, conflict strategy và smoke test riêng.
- Angel Wings là staging center có dữ liệu thật để test migration/sync. DreamHome production empty center là production trống, không seed demo và không trộn dữ liệu staging.
- C3.1 nên làm Auth + center switcher + membership guard; C3.2 nên làm shared cloud data MVP cho entity ít rủi ro trước khi realtime rộng.

## 2. Current state

Nền hiện có:

- `CURRENT_CENTER_ID = 'dreamhome'` trong `src/supabase-auth.js`.
- Supabase Auth email/password, session client-side qua publishable key.
- `center_members` đang là membership/role/display profile theo cơ sở.
- `center_cloud_entities` đang phục vụ C2/C2.3 cho `student`, `teacher`, `class_session`.
- C2/C2.3 đã có readiness gate: Supabase configured, signed-in user, membership, bảng cloud, RLS/permission.
- Cloud pull core có backup trước pull với prefix `ichessCenterOS.backup.beforeCloudPull.` và đã có hotfix rotate/prune quota.
- F19H.2 đã có dry-run/helper/docs/test cho `attendance_record`, `attendance_baseline_state`, `session_report`, `schedule_session`, `tuition_record`, `tuition_package`, `tuition_term`, `tuition_payment`.
- Deadline alerts hiện là local/read-only, compute từ TKB + canonical attendance + `sessionReports`.
- Notification UI đã có chuông tổng và chuông module, nhưng chưa phải realtime notification.

Giới hạn hiện tại:

- App vẫn mặc định một center là `dreamhome`; chưa có center switcher thật.
- Core C2 runtime allowlist vẫn giữ 3 entity cũ để không vỡ C2/C2.3.
- F19H.2 entity mở rộng là dry-run/patch plan, chưa phải auto sync production.
- Chưa có conflict UI cho nhiều người sửa cùng lúc.
- Chưa có app Giáo viên/QTV riêng, chưa có phân quyền thật ngoài membership đọc từ cloud.
- Angel Wings đang đóng vai staging dataset; DreamHome production empty center chưa được tạo thật trong phase này.

## 3. Target online model

Target online model gồm 5 lớp:

1. Identity: Supabase Auth xác thực người dùng.
2. Membership: `center_members` xác định user thuộc center nào, role nào, display profile nào.
3. Shared data: dữ liệu nghiệp vụ center-scoped, bắt đầu qua `center_cloud_entities`.
4. Client cache: localStorage/cache theo center, có `updatedAt`, `dirty`, `lastSyncedAt`, backup trước pull và pending queue khi offline.
5. Realtime: subscription theo `centerId` + entity/module, chỉ invalidate/refetch hoặc merge các payload đã validate.

Luồng đọc:

```txt
Supabase Auth -> center_members -> selected centerId -> cloud entities -> validated cache -> module read model
```

Luồng ghi online:

```txt
Module action -> local validation -> optimistic cache/draft -> cloud write with user/role audit -> realtime fan-out -> peer refetch/merge
```

Luồng offline hoặc cloud chưa ready:

```txt
Module action -> local cache + pending queue -> warning badge -> explicit retry/sync when ready
```

## 4. Multi-center model

Multi-center không được hard-code vào một `dreamhome` duy nhất ở C3.1+.

Đề xuất entity:

| Concept | Ý nghĩa | Ghi chú C3 |
| --- | --- | --- |
| `centers` | Danh sách cơ sở | Có `id`, `name`, `slug`, `environment`, `status`, `created_at` |
| `center_members` | User thuộc center và role | Nền hiện có, mở rộng role/permissions ở C3 |
| `center_cloud_entities` | Bridge dữ liệu shared theo center | Tiếp tục cho alpha, không auto mở rộng khi chưa có gate |
| `center_settings` future | Cấu hình riêng từng center | Có thể là entity hoặc bảng riêng sau |

Center ID khuyến nghị:

- `angel-wings-staging`: staging center chứa dữ liệu thật Angel Wings để test restore/sync/realtime.
- `dreamhome-production`: DreamHome production empty center, trống nghiệp vụ, chỉ có cấu hình tối thiểu và membership.
- `dreamhome` hiện tại: legacy/local alpha id. Cần migration plan trước khi đổi hoặc map sang production id.

Quy tắc:

- Mọi row cloud phải có `center_id`.
- Mọi localStorage key mới nên có center suffix hoặc adapter center-aware.
- User có thể thuộc nhiều center, nhưng mỗi thao tác module chỉ chạy trong một selected center.
- Không cho realtime subscription không lọc `center_id`.
- Không copy dữ liệu Angel Wings sang DreamHome production nếu chưa có thao tác migration được duyệt.

## 5. Staging vs production

Angel Wings staging:

- Dùng để kiểm thử restore, cloud dry-run, smoke, migration, realtime merge và conflict.
- Có thể chứa dữ liệu vận hành thật đã được người dùng cho phép dùng làm staging.
- Cho phép reset/reseed có checklist và backup.
- Không dùng để nghiệm thu production empty center.

DreamHome production empty center:

- Là cơ sở production trống, không có student/teacher/class/session/attendance/tuition demo.
- Chỉ có center row, owner/QTV membership, center settings tối thiểu.
- Không tự pull dữ liệu staging.
- Không tự tạo học viên/giáo viên mẫu.
- Cần manual checklist trước khi mở cho vận hành thật.

Promotion rule:

```txt
Angel Wings staging PASS -> review migration/export plan -> create or select DreamHome production empty center -> run production readiness checklist -> enable center for real users
```

## 6. Auth model

Auth dùng Supabase Auth với email/password trong alpha. Frontend chỉ dùng publishable key, không dùng service role, không gọi Admin API và không đọc `auth.users`.

Auth states:

| State | App behavior |
| --- | --- |
| Not configured | App chạy local-only, ẩn/disable online collaboration |
| Signed out | Cho xem local cache nếu có, yêu cầu login trước khi cloud sync/realtime |
| Signed in, no membership | Block cloud data, hiển thị lỗi membership theo center |
| Signed in, active membership | Cho vào selected center theo role |
| Membership suspended/inactive future | Block write, có thể cho read-only nếu policy cho phép |

Session handling:

- Auth state change chỉ refresh membership/center list, không tự destructive pull.
- Center switch cần clear module transient state và refetch theo selected center.
- Token hết hạn phải chuyển về signed-out hoặc read-only local cache, không làm mất dữ liệu draft.

## 7. Role model

Role alpha đề xuất:

| Role | Mục đích |
| --- | --- |
| `owner` | Chủ hệ thống/anh Hải, toàn quyền center, quản lý role và escalation |
| `qtv` | Quản trị vận hành cấp cao, xử lý cảnh báo, audit, sửa dữ liệu có kiểm soát |
| `center_admin` | Admin cơ sở, vận hành học viên/TKB/attendance/Học phí |
| `teacher` | Giáo viên, xem ca được phân công, điểm danh/báo cáo ca của mình |
| `consultant` | Tư vấn/chăm sóc, kiểm/nhập thay attendance trong scope được giao |
| `viewer` | Read-only nội bộ |

Nguyên tắc:

- Role nằm trong `center_members`, không nằm trong user global.
- Một user có thể có role khác nhau ở các center khác nhau.
- Mọi write cần audit `created_by`, `updated_by`, `submittedByRole` hoặc metadata tương đương.
- Teacher không được ghi đè attendance admin/consultant nếu logic nghiệp vụ đã khóa.
- QTV/owner correction phải giữ lịch sử sửa, không sửa âm thầm.

## 8. Permission matrix

Ma trận này là thiết kế C3.0, chưa phải RLS production.

| Module/Data | owner | qtv | center_admin | teacher | consultant | viewer |
| --- | --- | --- | --- | --- | --- | --- |
| Center settings | write | write | read | none | none | read |
| Membership/roles | write | write limited | none | none | none | none |
| Students | write | write | write | read assigned | read assigned | read |
| Teachers | write | write | write | read self/team | read | read |
| Class sessions | write | write | write | read assigned | read | read |
| Schedule/TKB | write | write | write | read assigned | read assigned | read |
| Teacher attendance | correct/audit | correct/audit | read/correct by policy | write own session | read | read |
| Admin/consultant attendance | write/correct | write/correct | write | read status | write assigned | read |
| Session reports | read/correct by policy | read/correct by policy | read | write own report | read assigned | read |
| Attendance baseline | approve/correct | approve/correct | write until locked | none | none | read |
| Tuition records | write | write | write | none | read assigned future | read |
| Cashflow/attachments | write | write | write by policy | none | none | read by policy |
| Inventory | write | write | write | none | none | read |
| Notifications/deadline | manage | manage | handle assigned | handle own | handle assigned | read |

Implementation direction:

- App guard first in C3.1/C3.2.
- RLS policies must enforce center membership for all shared rows.
- Role-specific RLS can start coarse, then tighten per table/entity before public multi-role rollout.

## 9. Realtime design

Realtime phải là incremental opt-in, không bật toàn app một lần.

Subscription rules:

- Subscribe only after Supabase configured, signed in, active membership and selected `centerId`.
- Filter by `center_id = selectedCenterId`.
- Filter by entity/table/module whenever possible.
- Cleanup subscription on sign-out, center switch, module unmount or browser tab close.
- Do not subscribe with service role or broad public channel.

Event handling:

```txt
INSERT/UPDATE/DELETE event -> validate center/entity/payload -> compare updatedAt/version -> merge or mark stale -> refresh affected module read model -> show non-blocking toast/badge if user is editing
```

Recommended rollout:

1. C3.2: no realtime write fan-out yet; manual shared cloud data MVP with refresh.
2. C3.3: realtime invalidation for low-risk entities like students/teachers.
3. C3.4: realtime TKB read refresh.
4. C3.5: realtime attendance/report with edit-lock/conflict warning.
5. C3.6+: notification/deadline realtime after server-side or shared-state model is stable.

Conflict guard:

- If current user is editing a form and remote update arrives, do not overwrite visible draft.
- Show "có cập nhật mới" badge and offer reload/compare.
- Apply remote update automatically only to non-dirty screens.

## 10. Source of truth and cache model

Online source of truth:

- Shared cloud data is canonical once an entity is enabled for online collaboration.
- LocalStorage remains cache/offline fallback and backup source.
- For entities not enabled online, localStorage remains source of truth.

Cache metadata cần có dần:

```txt
centerId
entityType
localId
payloadVersion
updatedAt
updatedBy
lastSyncedAt
dirty
pendingOperation
deletedAt
```

Rules:

- Pull must create backup before replacing local cache.
- Backup failure blocks destructive pull.
- Dry-run/preview before first push/pull of each entity type.
- No auto-push on page load.
- No auto-pull for high-risk modules until C3 readiness is accepted.
- Existing local drafts must survive auth changes and center switch warnings.

## 11. Conflict strategy

Alpha conflict strategy:

- Same entity/localId: newest valid `updatedAt` wins only when local copy is not dirty.
- Local dirty + remote changed: mark conflict, do not auto-merge.
- Delete is soft delete (`deleted_at`) first.
- Corrections create audit metadata, not silent replacement.
- Arrays with money/payment/history are high risk and need whole-record conflict warning.

Entity-specific notes:

- Attendance: different sources (`teacher`, `admin`, `consultant`, `initialBaseline`, `correction`) are facts, not one merged cell. Read model decides display priority.
- Session reports: report content is separate from canonical attendance. Legacy report attendance remains snapshot/adapter only.
- Schedule: recurring config and one-off sessions are distinct; occurrence table is future.
- Tuition: do not auto-update `usedSessions` from attendance until current term linkage is production-approved.

Future conflict UX:

- Conflict drawer showing local vs cloud changed fields.
- "Keep mine", "Use cloud", "Create correction" depending on entity type.
- Audit log visible to owner/qtv for sensitive changes.

## 12. Production empty center strategy

DreamHome production empty center must be created only in a later approved implementation phase.

Required production empty checklist:

- Center row exists with production environment marker.
- Owner/QTV membership exists and is tested.
- No student, teacher, class_session, schedule_session, attendance_record, session_report, tuition_record or inventory demo rows.
- Cloud readiness passes for production center.
- App can select production center without falling back to `dreamhome` legacy data.
- Backup/export path exists before first real import.
- Angel Wings staging remains separate and cannot be selected accidentally as production.

First production data should enter through one approved path:

- Manual create in app after center selected, or
- Reviewed import/migration job with dry-run diff, backup, and rollback.

## 13. Rollout roadmap C3.1->C3.9

| Phase | Scope | Exit gate |
| --- | --- | --- |
| C3.1 | Auth shell, center list/switcher, membership guard, role labels | User can sign in, see allowed centers, switch center without data mutation |
| C3.2 | Shared cloud data MVP for core entities via existing C2/C2.3 bridge | Manual refresh/sync works per selected center with backup and no realtime |
| C3.3 | Role-aware module guards for Admin/Teacher/Consultant/Viewer in app shell | Disallowed roles cannot access write actions client-side |
| C3.4 | Realtime invalidation for low-risk core entities | Remote student/teacher/class_session changes refresh safely |
| C3.5 | TKB + attendance/report online collaboration | Teacher/admin attendance and reports sync without duplicate canonical records |
| C3.6 | Tuition online collaboration | Tuition record/payment conflicts are guarded; no hidden attendance automation |
| C3.7 | DreamHome production empty center readiness | Production empty center can be selected and stays empty |
| C3.8 | Staging-to-production migration/import tooling | Angel Wings staging export can be reviewed before production import |
| C3.9 | Notification/deadline realtime and operational polish | Module notifications reflect shared state without broad global noise |

C3.1/C3.2 should deliberately avoid broad realtime and avoid high-risk tuition/attendance automation.

## 14. Risks and open questions

Risks:

- Hard-coded `dreamhome` can leak staging/local data into future production if center-aware storage is not done carefully.
- `center_cloud_entities` is safe for alpha but JSON payload limits server-side query/RLS depth.
- Realtime can overwrite active drafts if event handling is too eager.
- Teacher/consultant role boundaries need business confirmation before real RLS tightening.
- Tuition/payment conflicts can lose financial history if treated as simple latest-wins arrays.
- Production empty center can be polluted by demo/staging seed if import tools are not gated.
- Offline edits need clear pending/conflict indicators before multi-user rollout.

Open questions:

- Do `owner` and `qtv` need different RLS policies, or only different UI labels in alpha?
- Should `teacher` membership link to `teacher.id` through `center_members.profile_ref` or a separate mapping table?
- When should `center_cloud_entities` be replaced by normalized tables for attendance/TKB/Học phí?
- Should production center id be `dreamhome-production`, `dreamhome`, or a UUID-backed slug?
- Does Angel Wings staging remain in the same Supabase project as production, or move to separate project after alpha?
- Which entity is safest for first realtime proof: `student`, `teacher`, or `class_session`?
- What is the minimal conflict UI acceptable before letting multiple admins edit Học phí?

## 15. Readiness gates for C3.1/C3.2

C3.1 readiness:

- No SQL is run by the app.
- Supabase config missing state remains local-only.
- Signed-in user without membership is blocked from cloud data.
- Center selector lists only memberships returned by RLS.
- Selected center is explicit in UI and storage adapters.
- Role label is visible but does not pretend to be complete production security.

C3.2 readiness:

- Entity allowlist is explicit.
- Push/pull actions are user-triggered.
- Pull creates backup and blocks on backup failure.
- Dry-run shows count and affected entity types.
- `centerId` mismatch blocks sync.
- C2/C2.3 smoke remains green.
- F19H.2 dry-run tests remain green.
- No production empty center is created automatically.
