# F23.5A - Center Calendar Data Foundation Local-Safe

Ngày: 22/07/2026

Phạm vi: data/storage foundation local-safe trên `main`. Phase này không render UI TKB, không thêm form, không seed dữ liệu demo, không Auth/Supabase/SQL/deploy, không Teacher secret, không push/commit.

## 1. File đã tạo

- `src/center-calendar-data.js`
- `tests/f23-5a-center-calendar-data-foundation-local-safe-smoke.js`
- `docs/f23-5a-center-calendar-data-foundation-local-safe.md`

Không sửa `src/schedule-module.js`, `src/settings-module.js`, `src/main.js`, Điểm danh, Học phí, Teacher Portal hoặc Teacher Workspace.

## 2. Storage key center-scoped

Foundation dùng key riêng theo cơ sở:

- `ichessCenterOS.centerCalendarItems.<centerId>`
- `ichessCenterOS.centerCalendarTags.<centerId>`

Helper normalize `centerId` theo cùng tinh thần localStorage hiện có: trim, lowercase, chỉ giữ chữ/số/gạch dưới/gạch ngang. Mỗi cơ sở đọc một namespace riêng, nên dữ liệu cơ sở A không lọt sang cơ sở B.

Load lần đầu trả `[]`. Malformed JSON, object không phải array hoặc storage không sẵn sàng đều fallback `[]` và không crash.

## 3. Model item

`centerCalendarItems[]` chỉ chứa nội dung không phải lớp học:

```txt
{
  id,
  centerId,
  itemType,
  itemSubtype,
  title,
  description,
  startAt,
  endAt,
  allDay,
  location,
  roomId,
  colorKey,
  customColor,
  tagId,
  tagLabel,
  participantType,
  participantIds,
  teacherIds,
  staffIds,
  recurrenceRule,
  sourceModule,
  linkedSessionId,
  linkedClassSessionId,
  isCancelled,
  createdBy,
  createdAt,
  updatedAt
}
```

Normalize item:

- trim string;
- `participantIds`, `teacherIds`, `staffIds` clean và unique;
- `allDay`, `isCancelled` normalize boolean;
- `startAt`, `endAt`, `createdAt`, `updatedAt` normalize ISO datetime;
- thiếu `title`, thiếu/invalid time hoặc `endAt < startAt` thì item bị reject an toàn;
- `sourceModule` mặc định là `center-calendar`;
- `linkedSessionId` và `linkedClassSessionId` chỉ là field readiness, F23.5A không tự set.

## 4. Model tag

`centerCalendarTags[]`:

```txt
{
  id,
  centerId,
  label,
  colorKey,
  customColor,
  defaultItemType,
  description,
  isActive,
  createdAt,
  updatedAt
}
```

Normalize tag:

- `label` bắt buộc;
- `defaultItemType` ngoài allowlist fallback `other`;
- `isActive` mặc định `true`;
- không seed tag demo;
- tag chỉ phục vụ hiển thị/filter, không thay đổi nghiệp vụ của item.

## 5. Allowed item types

Allowlist chính thức của F23.5A:

- `meeting` - Hội họp
- `event` - Sự kiện
- `tournament` - Giải đấu
- `other` - Hoạt động khác

Store này tuyệt đối không nhận các type lớp học:

- `fixedClass`
- `makeupClass`
- `extraClass`
- `classSession`
- `scheduleSession`
- `teachingSession`

Nếu input có type lớp học, helper reject và không âm thầm đổi thành calendar item.

## 6. Preset và custom color

Preset hiện có:

- `meeting`: `orange`, `#f97316`
- `event`: `green`, `#22c55e`
- `tournament`: `emerald`, `#059669`
- `other`: `yellow`, `#eab308`

`customColor` chỉ nhận hex an toàn dạng `#RRGGBB`. Chuỗi CSS tùy ý, `url(...)`, expression hoặc giá trị không hợp lệ bị bỏ qua và UI phase sau có thể fallback preset theo `itemType`.

Màu và tag không được dùng để suy ra nghiệp vụ. Meeting màu xanh vẫn là meeting; event màu cam vẫn không phải buổi học.

## 7. Helper/API

`src/center-calendar-data.js` export:

- constants: `CENTER_CALENDAR_ITEM_TYPES`, `CENTER_CALENDAR_ITEM_TYPE_LABELS`, `CENTER_CALENDAR_COLOR_PRESETS`
- guard: `isCenterCalendarItemType`, `isRejectedClassCalendarItemType`
- normalize: `normalizeCenterCalendarItem`, `normalizeCenterCalendarItems`, `normalizeCenterCalendarTag`, `normalizeCenterCalendarTags`
- storage: `getCenterCalendarItemsStorageKey`, `getCenterCalendarTagsStorageKey`, `loadStoredCenterCalendarItems`, `saveStoredCenterCalendarItems`, `loadStoredCenterCalendarTags`, `saveStoredCenterCalendarTags`
- lookup/range: `getCenterCalendarItemsForRange`, `getCenterCalendarItemById`, `getCenterCalendarTagById`, `getCenterCalendarPresetForType`

Storage helpers nhận `centerId` và optional `storage` để test/local-safe. Phase này không import vào runtime UI.

## 8. Range helper

`getCenterCalendarItemsForRange(items, startAt, endAt, options)`:

- chỉ normalize/filter/sort;
- trả item giao với khoảng thời gian;
- sort ổn định theo `startAt`, rồi `title`, rồi `id`;
- không mutate source array;
- mặc định vẫn trả item `isCancelled` kèm flag để phase UI sau tự quyết định hiển thị; có thể truyền `includeCancelled: false`;
- không expand recurrence.

## 9. Recurrence defer

F23.5A chỉ giữ `recurrenceRule` ở dạng readiness field. Nếu không có recurrence thì normalize về `null`. Nếu có object legacy/future thì giữ object và normalize `frequency`, nhưng không generate occurrence, không clone hàng tuần, không sửa single occurrence/series.

## 10. Boundary với TKB và nghiệp vụ học vụ

F23.5A không render UI TKB và không sửa grid TKB. Slot dạy cố định vẫn từ `classSessions`/Cài đặt cơ sở, buổi học thật vẫn từ model lịch học hiện có.

`centerCalendarItems` không được nối:

- Điểm danh;
- Học phí;
- `tuition.usedSessions`;
- Báo cáo ca dạy;
- Teacher Portal ca dạy;
- Teacher Workspace;
- `classSessions`;
- `scheduleSessions`;
- session identity của buổi học.

Calendar item có thể có `teacherIds` như người tham gia, nhưng đó không phải teacher assignment của lớp.

## 11. Không seed demo

Preset constants không phải user data. Load lần đầu của cả items và tags trả `[]`; không có họp mẫu, sự kiện mẫu, giải đấu mẫu hoặc tag mẫu được ghi vào localStorage.

## 12. F23.5B tiếp theo

F23.5B có thể import foundation này để render read-only overlay trên TKB:

- overlay item theo tuần;
- label type + màu/tag;
- detail read-only riêng;
- vẫn giữ `+ Thêm buổi học` cho lịch học thật;
- chưa được nối item vào Điểm danh/Học phí/Báo cáo ca dạy.

## 13. Checks

Các check cần chạy cho phase này:

- `node --check src/center-calendar-data.js`
- `node --check tests/f23-5a-center-calendar-data-foundation-local-safe-smoke.js`
- `node tests/f23-5a-center-calendar-data-foundation-local-safe-smoke.js`
- regression TKB/storage hiện có phù hợp
- `npm run build`
- `git diff --check`
- scan mojibake trên file tạo/sửa
