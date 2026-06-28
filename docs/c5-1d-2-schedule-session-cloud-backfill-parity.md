# C5.1D.2 - Schedule Session Cloud Backfill + TKB Parity

## Summary

C5.1D.2 thêm một helper thủ công để backfill TKB local hiện tại lên cloud `schedule_session` qua `center_cloud_entities`. Helper này dành cho manual QA alpha sau C5.1D.1, khi hai browser đều fallback local vì cloud `schedule_session` trống.

Helper không tự chạy khi app load, không xóa cloud data, không xóa local data, không seed ngầm, không đụng SQL và không mở rộng sang C5.2 hay sync toàn bộ module.

## Manual QA Issue

- Browser T đang có TKB Angel Wings 8 ca.
- Browser L/P đang có seed cũ 6 ca.
- cloud `schedule_session` đang trống.
- Cả hai browser đều hiển thị fallback local: cloud schedule_session trống nên TKB đọc cache cục bộ.

## Root Cause

C5.1D.1 đã sửa việc báo Cloud giả cho TKB, nhưng chưa thể tạo parity nếu cloud `schedule_session` chưa có dữ liệu. Khi cloud trống, mỗi browser tiếp tục dùng localStorage riêng, nên browser T và L/P có thể khác nhau.

Canonical alpha tạm thời là browser T của user, nơi đang hiển thị Angel Wings 8 ca. Cần một backfill thủ công từ đúng browser này để cloud có `schedule_session`, rồi các browser reload sẽ cùng đọc cloud.

## Backfill Helper Design

Helper được expose ở Console:

```js
window.__ichessCenterOS.backfillScheduleSessionsToCloud(options)
```

Guard chính:

- Manual only: helper chỉ chạy khi user gọi rõ từ Console.
- Dry-run bắt buộc cho preview: `dryRun: true` không ghi cloud.
- Apply cần confirm token: `confirm: "BACKFILL_SCHEDULE_SESSION"`.
- Admin-only role guard: cho phép `owner`, `qtv`, `center_admin`, `admin`; chặn teacher/consultant/viewer.
- Center guard: chỉ dùng current center, payload có `centerId` và `center_id`.
- Entity hẹp: chỉ ghi `schedule_session` vào `center_cloud_entities`.
- No hard delete: không xóa cloud row, không xóa localStorage.
- Conflict guard: nếu cloud có record cùng `local_id` mới hơn local thì skip, trừ khi user chủ động truyền `overwrite: true`.
- Angel Wings warning: dry-run cảnh báo nếu preview chưa thấy tín hiệu Angel Wings.

## Dry-Run Usage

Chỉ chạy từ browser T đang có Angel Wings 8 ca:

```js
await window.__ichessCenterOS.backfillScheduleSessionsToCloud({ dryRun: true })
```

Kỳ vọng:

- `ok: true`
- `dryRun: true`
- `centerId` và `center_id` là center hiện tại
- `localScheduleSessionCount: 8`
- `candidateCount: 8`
- `sampleTitles` hoặc source metadata có tín hiệu Angel Wings
- `wouldUpsert: 8` nếu cloud đang trống
- `wouldOverwrite: 0` nếu cloud đang trống
- `warnings: []` hoặc user phải đọc kỹ warning trước khi apply

Không chạy apply từ browser L/P đang có seed cũ 6 ca.

## Apply Usage

Sau khi dry-run đúng Angel Wings 8 ca:

```js
await window.__ichessCenterOS.backfillScheduleSessionsToCloud({
  dryRun: false,
  confirm: "BACKFILL_SCHEDULE_SESSION"
})
```

Kỳ vọng:

- `ok: true`
- `dryRun: false`
- `upserted: 8`
- `errors: 0`

Nếu cloud đã có record mới hơn local, helper sẽ skip record đó. Chỉ dùng `overwrite: true` khi user đã đọc preview và chấp nhận ghi đè:

```js
await window.__ichessCenterOS.backfillScheduleSessionsToCloud({
  dryRun: false,
  confirm: "BACKFILL_SCHEDULE_SESSION",
  overwrite: true
})
```

## Manual QA After Backfill

1. Mở browser T, nơi TKB đang có Angel Wings 8 ca.
2. Đăng nhập role admin/Quản lý cơ sở hoặc role được phép ghi cloud.
3. Chạy dry-run trong Console.
4. Chỉ apply nếu preview đúng Angel Wings 8 ca.
5. Reload browser T và browser L/P.
6. Mở TKB tuần `22/06/2026 - 28/06/2026`.
7. Hai browser phải cùng đọc cloud `schedule_session`, cùng số ca và cùng cards.
8. Module 13/Bảng điểm danh không đổi behavior.
9. Học phí/TBHP không được nhận thêm source-of-truth từ TKB.

## Not Changed

- No SQL.
- No apply SQL.
- No Supabase schema/manual action.
- No automatic backfill.
- No cloud data removal.
- No localStorage removal.
- No C5.2.
- No all-module sync.
- No attendance backfill.
- No tuition/TBHP source of truth.
- No signUp/Đăng ký.
- No commit/push.

## Rollback Notes

Runtime rollback là gỡ helper `backfillScheduleSessionsToCloud` và module `cloud-schedule-session-backfill.js`. Nếu user đã apply nhầm seed cũ lên cloud, không dùng app để xóa; cần dừng và review thủ công dữ liệu cloud theo backup/SQL console được duyệt riêng.

## Next Phase

C5.1D manual QA retry after schedule_session backfill.
