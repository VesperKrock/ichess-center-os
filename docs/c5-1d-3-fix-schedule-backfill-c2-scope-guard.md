# C5.1D.3 - Fix Schedule Backfill C2 Scope Guard

## Summary

C5.1D.3 sửa hotfix C5.1D.2 sau khi dry-run manual từ browser T bị chặn bởi guard C2-only. `schedule_session` là entity thuộc C4/C5 schedule scope, đã có allowlist/backend readiness trước đó, nên backfill helper không được đi qua guard chỉ cho `student`, `teacher`, `class_session`.

Phase này chỉ sửa helper và preview. Không chạy apply, không ghi cloud, không SQL, không C5.2, không commit/push.

## Manual QA Dry-Run Issue: blocked C2

User chạy:

```js
await window.__ichessCenterOS.backfillScheduleSessionsToCloud({ dryRun: true })
```

Kết quả bị block:

- `blocked: true`
- `reason: "Entity type không thuộc phạm vi C2."`
- `entityType: "schedule_session"`
- `localScheduleSessionCount: 40`
- `candidateCount: 0`
- `skippedCount: 40`

## Root Cause

Backfill helper C5.1D.2 dùng generic `listCloudEntities` trong `cloud-db-sync.js`. Hàm này vẫn là guard C2-only cho các entity core đời cũ, nên `schedule_session` bị trả lỗi trước khi preview được tạo.

Ngoài ra, local browser T có 40 schedule records trong storage. Dry-run cần phân biệt raw local count với TKB đang render, vì mục tiêu QA hiện tại là backfill đúng nguồn Angel Wings đang hiển thị, không đẩy bừa toàn bộ 40 local records.

## Fix Applied

- Backfill chuyển sang read path riêng `listScheduleSessionCloudEntities`, chỉ query `center_cloud_entities` với `entity_type = schedule_session`.
- Không mở generic guard cho entity khác.
- `main.js` truyền thêm `visibleScheduleSessions: getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate)`, tức nguồn TKB đang render.
- Preview tách rõ:
  - `localScheduleSessionCount`
  - `visibleWeekCandidateCount`
  - `eligibleCandidateCount`
  - `candidateCount`
  - `sampleTitles`
  - `sampleIds`
  - `skippedReasons`
  - `wouldUpsert`
  - `wouldOverwrite`
- Preview dedupe theo `local_id`, skip deleted rows, và không ghi cloud khi `dryRun: true`.
- Nếu local raw count lớn hơn visible source, helper cảnh báo rằng preview chỉ lấy card TKB đang render.
- Nếu sample không có Angel Wings, helper cảnh báo: không apply nếu nguồn chưa đúng.

## Safety

- Manual only: app load chỉ expose helper.
- Dry-run no-write: `dryRun: true` không upsert.
- Apply cần confirm token: `BACKFILL_SCHEDULE_SESSION`.
- Role guard: chỉ `owner`, `qtv`, `center_admin`, `admin`.
- Center guard: chỉ current center, trả `centerId` và `center_id`.
- No delete: không delete/truncate/clear cloud/local.
- No all-module sync.
- No teacher/consultant write mở thêm.

## Manual QA Retry

Chạy lại từ browser T đang hiển thị Angel Wings 8 ca:

```js
await window.__ichessCenterOS.backfillScheduleSessionsToCloud({ dryRun: true })
```

Kỳ vọng:

- `ok: true`
- `blocked` không phải `true`
- `entityType: "schedule_session"`
- `localScheduleSessionCount` có thể vẫn là 40
- `visibleWeekCandidateCount` phản ánh TKB đang render
- `candidateCount > 0`
- `sampleTitles`/`sampleIds` khớp Angel Wings
- `wouldUpsert > 0` nếu cloud `schedule_session` trống
- không còn lỗi `Entity type không thuộc phạm vi C2.`

Chỉ apply nếu preview đúng Angel Wings:

```js
await window.__ichessCenterOS.backfillScheduleSessionsToCloud({
  dryRun: false,
  confirm: "BACKFILL_SCHEDULE_SESSION"
})
```

Không apply nếu sample không phải Angel Wings hoặc candidate count không khớp TKB user muốn làm canonical.

## Not Changed

- No SQL.
- No apply SQL.
- No Supabase manual action.
- No automatic backfill.
- No cloud/local delete.
- No C5.2.
- No all-module sync.
- No attendance backfill.
- No tuition/TBHP source of truth.
- No signUp/Đăng ký.
- No commit/push.

## Next Step

User chạy lại dry-run từ browser T. Nếu preview là Angel Wings đúng nguồn, user tự apply backfill, rồi reload hai browser để kiểm tra TKB parity.
