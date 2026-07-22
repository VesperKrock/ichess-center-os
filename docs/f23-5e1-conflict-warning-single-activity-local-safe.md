# F23.5E1 - Conflict warning single activity local-safe

## Mục tiêu

F23.5E1 triển khai nền cảnh báo trùng lịch cho hoạt động cơ sở đơn lẻ trong Module Thời khóa biểu. Luồng chỉ chạy khi người dùng bấm Lưu trong form tạo/sửa `centerCalendarItem`, đọc dữ liệu local hiện có ở chế độ read-only và không sửa/chặn dữ liệu lớp học hoặc buổi học thật.

Không Auth/Supabase/SQL/deploy, không Teacher secret, không cloud sync, không recurrence engine, không participant/teacher conflict.

## Conflict module

File thuần Node: `src/center-calendar-conflicts.js`.

API chính:

- `detectCenterCalendarConflicts({ candidate, centerId, classSessions, scheduleSessions, centerCalendarItems, currentItemId })`
- `hasTimeOverlap(firstEntry, secondEntry)`
- `normalizeCenterCalendarRoomIdentity({ roomId, location })`
- `buildClassSessionConflictEntries(...)`
- `buildScheduleSessionConflictEntries(...)`
- `buildCenterCalendarItemConflictEntries(...)`
- `summarizeCenterCalendarConflicts(conflicts)`

Module không dùng DOM, không dùng `localStorage`, không render UI và không gọi storage. Runtime gọi module một lần trong `saveCenterCalendarItemFromForm`.

## Quy tắc overlap

Khoảng thời gian dùng chuẩn nửa mở `[start,end)`.

- Hai khoảng sát nhau không conflict: `09:00-10:00` và `10:00-11:00`.
- Khoảng giao nhau một phần hoặc chứa nhau là conflict.
- All-day dùng `00:00` ngày bắt đầu đến `00:00` ngày kế tiếp.
- Cross-midnight được phép: nếu giờ kết thúc nhỏ hơn hoặc bằng giờ bắt đầu, form build cộng thêm 24 giờ cho `endAt`.
- Record thiếu thời gian hợp lệ bị bỏ qua để không tạo cảnh báo giả.

## Room normalization

Chuẩn phòng dùng `roomId` trước, sau đó mới dùng text từ `location`/`room`.

- `roomId` được trim và lower-case.
- Text phòng được trim, lower-case và gộp khoảng trắng.
- Không tự alias: `P1` không được coi là `Phòng 1`.
- Conflict phòng chỉ được kết luận khi cả hai phía có room identity và identity bằng nhau.

## Phân loại conflict

Hard conflict:

- Candidate overlap cùng phòng với `classSessions`.
- Candidate overlap cùng phòng với `scheduleSessions`.
- UI hiển thị `Không thể lưu do trùng lịch`.
- Người dùng chỉ có `Quay lại chỉnh sửa`.
- Không sửa hoặc chặn lớp học hiện có; chỉ chặn save hoạt động cơ sở mới/sửa.

Soft conflict:

- Candidate overlap cùng phòng với `centerCalendarItems` khác trong cùng cơ sở.
- UI hiển thị `Hoạt động đang trùng lịch`.
- Người dùng có `Quay lại chỉnh sửa` hoặc `Vẫn lưu`.
- `Vẫn lưu` chỉ lưu hoạt động đang pending, không chạy browser confirm.

Informational conflict:

- Candidate overlap thời gian nhưng không trùng phòng với nguồn khác.
- Dùng cho panel tham khảo khi đã có hard/soft.
- Không tự mở panel nếu chỉ có informational.

Marker UI dùng trong panel: `Lớp học`, `Buổi học`, `Trùng phòng`, `Xung đột thời gian`.

## Nguồn dữ liệu

`classSessions`:

- Được expand theo ngày trong range của candidate.
- Dùng `daysOfWeek`/day marker, giờ bắt đầu/kết thúc và room hiện có.
- Có thể lấy room/title overlay từ `scheduleSessions` cùng `classSessionId`.

`scheduleSessions`:

- Đọc một lần từ state hiện có.
- One-off session dùng `date`, `startTime`, `endTime`.
- Recurring orphan session không gắn `classSessionId` được expand nhẹ theo ngày để phục vụ dữ liệu cũ.
- Recurring session gắn `classSessionId` bị bỏ qua để tránh double count với lớp học thật.

`centerCalendarItems`:

- Chỉ xét cùng `centerId`.
- Bỏ qua item đang sửa bằng `currentItemId`.
- Bỏ qua cancelled/deleted.
- Archived tag vẫn không ảnh hưởng conflict vì conflict đọc activity item, không đọc tag state.

## Loại trừ

Các record bị bỏ qua:

- `cancelled`, `isCancelled`, `isDeleted`.
- Khác cơ sở.
- Chính item đang edit.
- Record thiếu start/end hợp lệ.

## Luồng Save

1. Người dùng điền form.
2. Không check khi gõ, click input, select, palette, filter hoặc nhãn.
3. Khi bấm Lưu, form build `pendingItem`.
4. Runtime gọi `detectCenterCalendarConflicts`.
5. Nếu có hard/soft, chuyển sang panel conflict và giữ nguyên form state trong `previousState.values`.
6. `Quay lại chỉnh sửa` restore form state.
7. `Vẫn lưu` chỉ xuất hiện khi không có hard conflict và lưu pending item.

Không dùng `window.confirm`. Panel là state riêng của schedule module, không dùng module launcher nên không reopen module và không tạo full render giữa field interactions.

## Không recurrence

F23.5E1 chưa triển khai recurrence MVP. Design F23.5E0 vẫn là nền cho F23.5E2: weekly master/virtual occurrence sẽ được so sánh với materialized records sau, nhưng E1 chỉ xử lý hoạt động đơn lẻ.

Không có exception từng occurrence, không participant conflict, không teacher conflict, không drag-drop, không PDF, không migration storage.

## Kiểm thử

Smoke mới: `tests/f23-5e1-conflict-warning-single-activity-local-safe-smoke.js`.

Các vùng được bảo vệ:

- Pure conflict module chạy bằng Node.
- Half-open overlap, adjacent time, all-day, cross-midnight.
- Room normalization theo `roomId` trước `location`.
- Hard block với lớp/buổi học thật.
- Soft override với hoạt động cơ sở khác.
- Cancelled/self/different-center ignored.
- Panel hard không có `Vẫn lưu`, panel soft có `Vẫn lưu`.
- F23.5B.1: field interactions không mở lại module và không conflict-check ồn khi gõ.
