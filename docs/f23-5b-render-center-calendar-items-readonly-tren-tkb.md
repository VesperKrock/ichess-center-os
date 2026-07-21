# F23.5B - Render Center Calendar Items Read-Only Trên TKB

Ngày: 22/07/2026

Phạm vi: render read-only `centerCalendarItems` lên lưới Thời khóa biểu hiện tại. Không form tạo/sửa/xóa, không nút `+ Thêm hoạt động`, không tag UI/filter/legend, không recurrence engine, không conflict UI, không PDF, không seed demo, không Auth/Supabase/SQL/deploy, không Teacher secret, không push/commit.

## 1. Render layer

`src/main.js` đọc item bằng helper F23.5A:

```txt
loadStoredCenterCalendarItems(getCurrentResolvedCenterId())
```

Sau đó truyền vào `renderScheduleModule()` qua `deadlineOptions.centerCalendarItems`.

`src/schedule-module.js` chỉ nhận dữ liệu đã truyền, lọc theo tuần đang xem bằng `getCenterCalendarItemsForRange()`, rồi render card riêng trong lane từng ngày. Calendar item nằm sau các card buổi học để không che fixed slot hoặc assignment hiện có.

## 2. Center và range

Storage key theo cơ sở:

```txt
ichessCenterOS.centerCalendarItems.<centerId>
```

TKB không hardcode `dreamhome`. Khi đổi center, `getCurrentResolvedCenterId()` đổi thì helper đọc namespace tương ứng. Malformed storage vẫn trả `[]` theo foundation F23.5A.

Range tuần:

- start: thứ 2 của tuần đang xem, `00:00`;
- end: thứ 2 tuần sau, `00:00`;
- chỉ item giao với tuần được render;
- item ngoài tuần không render;
- item qua ngày được render ở các ngày có giao thời gian, không tạo recurrence.

## 3. Type, label và màu

Allowlist render:

- `meeting` - Hội họp - cam;
- `event` - Sự kiện - xanh lá;
- `tournament` - Giải đấu - xanh giải đấu;
- `other` - Hoạt động khác - vàng.

Card luôn có type label bằng chữ, không chỉ dựa vào màu. Nếu `customColor` hợp lệ dạng `#RRGGBB`, card dùng màu đó qua CSS variable `--schedule-calendar-item-color`. Giá trị custom đã được normalize ở foundation nên không nhận raw CSS tùy ý.

## 4. Card read-only

Card dùng marker riêng:

```txt
schedule-calendar-item
schedule-calendar-item--meeting
schedule-calendar-item--event
schedule-calendar-item--tournament
schedule-calendar-item--other
data-center-calendar-item-id
```

Card không dùng:

- `data-session-id`;
- `data-schedule-action="open-edit"`;
- attendance action;
- teacher report action;
- delete session action.

Nội dung hiển thị:

- type label;
- title;
- giờ hoặc `Cả ngày`;
- `location` hoặc `roomId` nếu có;
- `tagLabel` nếu có dữ liệu;
- mô tả ngắn nếu có;
- trạng thái `Đã hủy` nếu `isCancelled = true`.

## 5. Boundary học vụ

`centerCalendarItems` chỉ là nội dung lịch cơ sở, không phải buổi học.

F23.5B không nối Điểm danh, không nối Học phí, không tạo Báo cáo ca dạy, không update `tuition.usedSessions`, không tạo teacher assignment và không xuất hiện trong Teacher Portal như ca dạy. Field `teacherIds` nếu có chỉ là người tham gia.

Không sửa `classSessions`, không sửa `scheduleSessions`, không đổi fixed slot, không đổi nút `+ Thêm buổi học`.

## 6. Manual localStorage fixture

Mở app, vào đúng cơ sở cần QA, mở DevTools Console. Xác định `centerId` hiện tại bằng một trong hai cách:

```js
const centerId =
  window.__ICHESS_CENTER_ID__ ||
  localStorage.getItem('ichessCenterOS.currentCenterId') ||
  'dreamhome'
```

Nếu app không expose biến trên, xem center id trong màn hình quản trị hoặc dùng đúng id cơ sở đang test. Sau đó tạo key:

```js
const key = `ichessCenterOS.centerCalendarItems.${centerId}`
```

Thêm fixture nằm trong tuần đang xem. Sửa ngày giờ cho khớp tuần trên TKB trước khi chạy:

```js
const existing = JSON.parse(localStorage.getItem(key) || '[]')
const fixture = [
  {
    id: 'qa-f23-5b-meeting',
    centerId,
    itemType: 'meeting',
    title: 'QA họp giáo viên',
    startAt: '2026-07-22T08:00:00',
    endAt: '2026-07-22T09:00:00',
    location: 'Phòng họp',
    sourceModule: 'centerCalendar'
  },
  {
    id: 'qa-f23-5b-event',
    centerId,
    itemType: 'event',
    title: 'QA sự kiện cộng đồng',
    startAt: '2026-07-23T09:00:00',
    endAt: '2026-07-23T10:00:00',
    customColor: '#00ffaa',
    tagLabel: 'QA',
    sourceModule: 'centerCalendar'
  },
  {
    id: 'qa-f23-5b-tournament',
    centerId,
    itemType: 'tournament',
    title: 'QA giải đấu',
    startAt: '2026-07-24T13:30:00',
    endAt: '2026-07-24T16:30:00',
    roomId: 'Sảnh 1',
    isCancelled: true,
    sourceModule: 'centerCalendar'
  },
  {
    id: 'qa-f23-5b-other',
    centerId,
    itemType: 'other',
    title: 'QA hoạt động khác',
    startAt: '2026-07-25T00:00:00',
    endAt: '2026-07-25T23:59:00',
    allDay: true,
    location: 'Cơ sở',
    sourceModule: 'centerCalendar'
  }
]
localStorage.setItem(
  key,
  JSON.stringify([
    ...existing.filter((item) => !String(item?.id || '').startsWith('qa-f23-5b-')),
    ...fixture
  ])
)
```

Refresh hoặc mở lại TKB. Kỳ vọng thấy 4 card read-only: Hội họp, Sự kiện, Giải đấu, Hoạt động khác. Nếu tạo trùng giờ lớp học, cả lớp học và calendar item cùng còn, không ghi đè nhau.

Fixture không có `linkedSessionId`, không có `linkedClassSessionId`, không có student IDs và không có tuition data.

## 7. Cleanup an toàn

Không dùng `localStorage.clear()`. Chỉ xóa item QA theo prefix:

```js
const centerId =
  window.__ICHESS_CENTER_ID__ ||
  localStorage.getItem('ichessCenterOS.currentCenterId') ||
  'dreamhome'
const key = `ichessCenterOS.centerCalendarItems.${centerId}`
const existing = JSON.parse(localStorage.getItem(key) || '[]')
const cleaned = existing.filter((item) => !String(item?.id || '').startsWith('qa-f23-5b-'))
if (cleaned.length) {
  localStorage.setItem(key, JSON.stringify(cleaned))
} else {
  localStorage.removeItem(key)
}
```

Refresh TKB, các card QA biến mất. Dữ liệu thật không có prefix `qa-f23-5b-` được giữ nguyên.

## 8. Manual QA

- Mở TKB khi chưa có fixture: không có item demo.
- Fixed slot vẫn hiện.
- Slot `Chưa gán thông tin` vẫn hiện.
- Assignment giáo viên/lớp vẫn hiện.
- `+ Thêm buổi học` vẫn mở flow cũ.
- Buổi học đột xuất/học bù cũ vẫn hoạt động.
- Bảng Điểm danh không thấy meeting/event/tournament/other.
- Học phí không đổi số buổi.
- Teacher Portal preview không thấy calendar item như ca dạy.
- Cleanup fixture và refresh, item QA biến mất.

## 9. Tests

Checks cần chạy:

- `node --check src/schedule-module.js`
- `node --check src/center-calendar-data.js`
- `node --check tests/f23-5b-render-center-calendar-items-readonly-tren-tkb-smoke.js`
- `node tests/f23-5a-center-calendar-data-foundation-local-safe-smoke.js`
- `node tests/f23-5b-render-center-calendar-items-readonly-tren-tkb-smoke.js`
- regression TKB/class-session/attendance phù hợp
- `npm run build`
- `git diff --check`
- mojibake scan trên file tạo/sửa

## 10. F23.5C

Phase sau có thể thêm form tạo/sửa/xóa calendar item riêng. Form đó vẫn phải tách khỏi `+ Thêm buổi học`, không biến meeting/event/tournament/other thành `classSessions` hoặc `scheduleSessions`.
