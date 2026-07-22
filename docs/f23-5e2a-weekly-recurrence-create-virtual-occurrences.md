# F23.5E2A - Weekly recurrence create virtual occurrences

## Storage Strategy

F23.5E2A dùng `master series + virtual occurrences`.

Storage chỉ lưu một `centerCalendarItem` master có `recurrenceRule`. Runtime không materialize occurrence, không append occurrence vào `centerCalendarItems`, không tạo storage key riêng và không rewrite storage khi đổi tuần. Master `id` là series identity trong MVP.

## Rule Shape

MVP chỉ nhận weekly:

```js
{
  frequency: "weekly",
  interval: 1,
  daysOfWeek: ["mon", "wed"],
  endMode: "until",
  untilDate: "2026-12-31",
  count: null,
  timezone: "Asia/Ho_Chi_Minh"
}
```

Count mode dùng `endMode: "count"`, `count` từ 1 đến 52 và `untilDate: null`.

Không daily/monthly/yearly, không interval 2+, không cron/RRULE string tự do, không custom timezone.

## Validation

`src/center-calendar-recurrence.js` normalize và validate rule thuần Node:

- weekly phải có ít nhất một weekday;
- weekday chỉ gồm `mon` đến `sun`, dedupe và sort ổn định;
- `untilDate` inclusive và không trước anchor date;
- `count` là số nguyên 1-52;
- until mode sinh hơn 52 occurrence thì chặn save;
- invalid rule không được silently sửa để save.

## Anchor And Duration

Anchor là ngày trong `master.startAt`. Occurrence chỉ sinh từ anchor trở đi. Nếu anchor weekday nằm trong `daysOfWeek`, anchor có thể là occurrence đầu tiên; nếu không, occurrence đầu tiên là weekday kế tiếp.

Occurrence giữ local start time và duration của master. Cross-midnight như `22:00-01:00` giữ duration 3 giờ và end sang ngày kế tiếp. All-day giữ semantics một local calendar day.

## Occurrence Identity

ID deterministic:

```txt
<masterId>@<YYYY-MM-DD>
```

Virtual occurrence có marker:

- `isVirtualOccurrence: true`
- `masterId`
- `occurrenceId`
- `occurrenceDate`
- `startAt`
- `endAt`

Occurrence ID không persist và không được dùng như storage item ID để edit/delete.

## Range Expansion

TKB chỉ expand trong tuần đang xem. Conflict save series expand toàn series hữu hạn nhưng cap 52. Expansion sort theo `startAt`, title, id và không mutate master.

## Create Series Flow

Form `+ Thêm hoạt động` có section `Lặp lại`:

- `Không lặp`
- `Hàng tuần`
- weekday buttons `T2 T3 T4 T5 T6 T7 CN`
- `Kết thúc`: `Vào ngày` hoặc `Sau số lần`

Click weekday chỉ cập nhật form state và DOM cục bộ, không mở lại module, không chạy conflict khi gõ.

Khi Save:

1. validate activity;
2. validate recurrence;
3. build one master candidate;
4. expand candidate occurrences;
5. chạy conflict engine E1 cho từng occurrence;
6. không conflict thì lưu đúng một master;
7. hard conflict thì block toàn chuỗi;
8. soft conflict thì cho `Quay lại chỉnh sửa` hoặc `Vẫn lưu toàn bộ chuỗi`.

## Conflict Aggregation

Series hard conflict với `classSessions`/`scheduleSessions` cùng phòng sẽ chặn toàn chuỗi. Activity/recurring occurrence khác là soft conflict và có override toàn chuỗi.

Existing recurring masters cũng được expand làm conflict source cho single activity E1 và series E2A. Cancelled/self/different-center bị bỏ qua.

Panel conflict gộp summary, không mở nhiều modal.

## Render, Filter, Legend

TKB tách single item và recurring master. Single item render như trước; weekly master expand ra virtual occurrence trong tuần. Master không render duplicate ở anchor week.

Filter type/tag áp dụng trên occurrence với logic AND. Legend tuần tính từ occurrence đang xuất hiện. Tag manager vẫn đếm master item, không nhân count theo occurrence.

## Occurrence Detail

Click occurrence mở read-only detail:

- `Chi tiết hoạt động lặp lại`
- `Hoạt động lặp lại`
- ngày/giờ occurrence;
- type/title/location/tag/color;
- recurrence summary.

F23.5E2A chỉ có action `Đóng`. Không edit/delete occurrence, không edit/delete whole series trong phase này.

## Center Scope And Cancelled

Series chỉ expand/conflict trong current center. Cancelled master có thể render trạng thái đã hủy nhưng không tạo hard/soft conflict và không block candidate khác.

## Boundary Lớp Học

Recurrence chỉ áp dụng cho `centerCalendarItems`.

Không tạo/sửa `classSessions`, `scheduleSessions`, attendance, tuition, Teacher Portal/Workspace, teacher assignment, report, PDF, cloud sync, Auth, Supabase, SQL hoặc deploy.

## Tests

Smoke chính: `tests/f23-5e2a-weekly-recurrence-create-virtual-occurrences-smoke.js`.

Các marker bắt buộc:

- `Lặp lại`
- `Không lặp`
- `Hàng tuần`
- `Vào ngày`
- `Sau số lần`
- `Hoạt động lặp lại`
- `Chi tiết hoạt động lặp lại`
- `Vẫn lưu toàn bộ chuỗi`
- `Quay lại chỉnh sửa`
- `Xung đột khác`

## Giới Hạn E2A

Không chỉnh sửa toàn bộ chuỗi, không xóa toàn bộ chuỗi, không sửa/xóa một occurrence, không exception từng lần, không monthly/daily.

## Roadmap E2B

F23.5E2B sẽ thêm chỉnh sửa và xóa toàn bộ chuỗi recurrence. Exception từng occurrence vẫn để phase sau.
