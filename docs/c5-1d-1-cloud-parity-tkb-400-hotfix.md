# C5.1D.1 - Cloud Parity TKB + Supabase 400 Hotfix

## 1. Summary

C5.1D.1 là targeted hotfix sau manual QA C5.1D. Mục tiêu là sửa blocker TKB hai browser cùng center/cùng Cloud nhưng hiển thị khác nhau, đồng thời audit nguồn Supabase 400 liên quan `center_cloud_entities`.

Không SQL, không Supabase manual action, không C5.2, không sync all modules đại trà, không commit/push.

## 2. Manual QA issue

Manual QA ghi nhận:

- Taskbar báo `Dữ liệu: Cloud` nhưng console còn 2 Supabase 400.
- TKB mismatch: Browser A hiển thị seed/local cũ 6 ca, Browser B hiển thị Angel Wings 8 ca.
- Cả hai browser cùng center/cùng Cloud.
- Module 13/Bảng điểm danh sau thao tác nhập/chốt nền mới có dấu hiệu sync, tạm chấp nhận; C5.1D.1 không backfill attendance nền cũ.

## 3. Root cause

TKB mismatch:

- `bootstrapCoreCloudDataForCurrentCenter` coi Cloud bootstrap là thành công nếu bất kỳ core entity nào có dữ liệu.
- Khi cloud có student/teacher nhưng `schedule_session` trống, taskbar vẫn có thể báo `Dữ liệu: Cloud` trong khi TKB tiếp tục render local cache.
- Vì mỗi browser có local cache khác nhau, một bên có thể còn 6 seed/local cũ, bên còn lại có Angel Wings 8 ca.
- Schedule runtime readiness trong `buildScheduleSessionRuntimeContext` và `writeScheduleSessionThroughCloud` vẫn hard-code `membershipSqlReady`, `scheduleSessionSqlReady`, `realtimeReady` là `false`, nên schedule_session write-through/realtime bị tự chặn dù backend C4/C5 đã được verify.

Supabase 400:

- Audit không thấy query `center_cloud_entities` order/filter theo invalid fields như `name` hoặc `created_at`.
- Các query bridge đang order bằng `updated_at`, field có trong SQL C1/C2.2.
- Hotfix giảm khả năng 400/degraded giả ở TKB bằng cách không claim Cloud cho TKB khi `schedule_session` cloud trống.

C5.1 interaction:

- C5.1 attendance realtime không thay đổi schedule handler trực tiếp.
- Blocker nằm ở C4 schedule runtime readiness/fallback status bị cũ sau khi backend đã sẵn sàng.

## 4. Fix applied

Schedule cloud source priority:

- Nếu cloud `schedule_session` non-empty, bootstrap vẫn apply schedule cloud vào local cache và taskbar báo Cloud.
- Nếu cloud `schedule_session` empty, bootstrap không còn báo `Dữ liệu: Cloud` cho TKB; trạng thái chuyển thành fallback rõ ràng: `Dữ liệu: Cache cục bộ (cloud schedule_session trống; TKB dùng local fallback)`.

Legacy fallback:

- Legacy/local schedule chỉ là fallback khi cloud schedule empty/error.
- Không còn che mismatch 6 seed/local vs 8 Angel Wings bằng taskbar Cloud giả.

400 query fix:

- Không phát hiện invalid `order=name` hoặc `order=created_at` trên `center_cloud_entities`.
- Không đổi SQL/query schema.
- Giữ order hợp lệ theo `updated_at`.

Realtime/bootstrap safety:

- `buildScheduleSessionRuntimeContext` dùng backend readiness true cho membership SQL, schedule_session SQL và realtime, dựa trên trạng thái user đã manual apply/verify.
- `writeScheduleSessionThroughCloud` truyền readiness true để schedule_session write-through không tự bị chặn.
- C3.4C schedule realtime smoke vẫn pass.

## 5. What was not changed

- No SQL.
- No Supabase manual action.
- No C5.2.
- No Học phí/TBHP source of truth.
- No attendance backfill.
- No migration/backfill local baseline cũ.
- No all-module sync.
- No Teacher Portal/Super Admin/check-in/out image.
- No commit/push.

## 6. Manual QA checklist

Two browser TKB parity:

- Open Browser A normal and Browser B incognito/Edge.
- Login same account/same center.
- Clear console in both.
- Confirm taskbar data status.
- Open TKB for week 22/06/2026 - 28/06/2026.
- If cloud `schedule_session` has data, both browsers must show same count/cards.
- If cloud `schedule_session` is empty, taskbar must show local fallback, not Cloud.
- No one browser should silently claim Cloud while rendering seed/local mismatch.

Console 400:

- Reload both browsers.
- Confirm console does not spam 400 during dashboard/cloud bootstrap.
- If any 400 remains, capture endpoint/query exactly.

Module 13 no regression:

- Open Bảng điểm danh.
- Existing data still renders.
- New save/chốt nền still writes local and C5.1 guarded write-through remains intact.

Học phí isolation:

- Open Học phí before/after attendance/TKB checks.
- No automatic `usedSessions` decrement.
- No automatic TBHP generation.

## 7. Next phase

C5.1D manual QA retry.

If QA pass: C5.1E checkpoint review.

If QA fail: targeted hotfix based on exact mismatch/endpoint.
