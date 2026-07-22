# F23.5E0 - Design Cảnh Báo Trùng Lịch Và Recurrence MVP

Date: 2026-07-22

Scope: design-only on `main`. This document does not implement runtime code, UI, storage migration, recurrence expansion, conflict detection, Auth, Supabase, SQL, deploy, Teacher secret, push, or commit.

## Audit Nền

`classSessions` are center-scoped configuration records from Cài đặt cơ sở. The current Settings form stores the teaching days, start/end time, status, name/display label, and notes. Runtime can still read `classSession.room` when old or seeded data contains it, but the current Settings form is not a room-management UI.

`scheduleSessions` are the real lesson/session records. In `schedule-module.js`, `getVisibleScheduleSessions()` builds the visible week by combining:

- fixed teaching slots derived from active `classSessions`;
- recurring schedule assignments linked by `classSessionId`;
- one-off schedule sessions such as học bù, học thử, học thêm, and other real lessons;
- orphan recurring schedule records only when they are not backed by a visible class session.

`centerCalendarItems` are separate center activities: `meeting`, `event`, `tournament`, `other`. `main.js` loads them with `loadStoredCenterCalendarItems(getCurrentResolvedCenterId())` and passes them into `renderScheduleModule()`. `schedule-module.js` filters the current week through `getCenterCalendarItemsForRange()`, applies F23.5D type/tag filters only to calendar items, then renders cards beside lessons. Tags are read from `centerCalendarTags`.

Room/location reality today:

- lessons primarily use `scheduleSession.room` text;
- fixed class slots use `classSession.room` only if available in data;
- calendar activities have `location` text and a `roomId` readiness field, but the F23.5C form currently writes `location`;
- no official room directory or alias map exists yet.

Current week range is computed in `renderScheduleModule()` from `weekStartDate`, using Monday `00:00` through next Monday `00:00`. Calendar item range matching already uses half-open ISO datetime overlap, but it does not expand recurrence. Existing schedule-session conflicts use same-day time strings and only compare visible lesson/session cards; that helper is not sufficient for cross-midnight activity conflict.

`centerCalendarItems.recurrenceRule` already exists as a readiness field. F23.5A normalizes an object and `frequency`, but no recurrence engine exists.

Attendance and Teacher Portal read class/session signals such as `classSessionId`, `scheduleSessionId`, `teacherId`, `studentIds`, and session reports. Activities must not enter those flows.

## Sources To Compare

Future conflict detection for activity save should read three sources, all read-only:

1. Fixed teaching slots from `classSessions`, expanded only for the relevant date range.
2. Real `scheduleSessions`, including one-off lessons and recurring assignments.
3. `centerCalendarItems`, including single items and virtual occurrences from recurring activity masters.

The conflict engine must never rewrite or move `classSessions` or `scheduleSessions`. It only warns or blocks the activity being created/edited.

## Overlap Rule

Use half-open intervals:

```txt
startA < endB && startB < endA
```

An activity ending at 10:00 and another starting at 10:00 are not overlapping.

Rules:

- compare real timestamps, not time strings without dates;
- use normalized datetimes for all sources;
- represent all-day local dates as `[localDate 00:00, nextLocalDate 00:00)`;
- MVP timezone should be `Asia/Ho_Chi_Minh` until the app has per-center timezone settings;
- do not infer timezone from browser locale if it can shift stored data;
- cross-midnight items keep one interval spanning both dates.

## Room Identity

Preferred future identity order:

1. Compare `roomId` if both sides have a canonical id.
2. Else compare normalized room/location text:
   - trim;
   - lowercase;
   - collapse whitespace.
3. Do not auto-map aliases such as `Phòng 1` and `P1` until a room directory exists.

Text-only matches are less certain than canonical ids. For activity vs activity they should usually be soft. For activity vs real class, a text match can be hard only when the lesson/class side clearly has a room and the activity explicitly chose the same room/location text.

## Conflict Severity

### Hard

Hard conflict means save should not proceed without a stronger future policy. F23.5E1 should block hard conflict with real classes by default.

Hard examples:

- activity overlaps a real class/session and both have the same `roomId`;
- activity overlaps a real class/session and both have the same clear normalized room text;
- all-day activity with a room overlaps any real class/session in that room on that local date;
- recurring activity occurrence overlaps a real class/session in the same room.

MVP behavior: do not save the activity. Show `Cảnh báo trùng lịch`, `Trùng phòng`, the class/session title, room, and time. Only offer `Quay lại chỉnh sửa`.

### Soft

Soft conflict means save can continue after warning. It does not change any existing data.

Soft examples:

- two activities overlap and share the same text-only location;
- two activities overlap with no canonical room id;
- activity overlaps another activity in the same `roomId`;
- all-day activity without room overlaps timed activities or classes;
- activity has no room but overlaps a day/time where classes exist.

MVP behavior: show summary with `Quay lại chỉnh sửa` and `Vẫn lưu`.

### Informational

Informational conflict should not block save and should be quiet unless useful.

Examples:

- overlapping activities in different rooms;
- cancelled items in the same room/time;
- adjacent intervals that do not overlap;
- items without room that only share broad center time;
- activity near another item but not overlapping.

MVP behavior: show only inside a detail/summary if it helps explain context. Do not create noisy modals.

## Real Class Boundary

Real class/session data wins. If an activity overlaps a real class in the same room:

- the activity gets a hard warning;
- the class slot is not moved;
- the assignment is not changed;
- no attendance is created or edited;
- tuition is not touched;
- Teacher Portal does not receive the activity as a teaching session.

F23.5E1 should not provide override for hard conflict with real classes. Local-safe has no real permission model or audit trail, so allowing override would create false authority. Future cloud phases can revisit override with owner/admin roles and audit log.

## Activity-To-Activity Conflict

Activity-to-activity conflict is lower risk than activity-to-class conflict.

Recommended F23.5E1 behavior:

- same canonical room and overlap: hard-looking warning, but allow `Vẫn lưu`;
- same text-only location and overlap: soft warning;
- both no room/location: soft or informational, depending on duration;
- cancelled target item: informational only;
- the item being edited should not conflict with itself.

Calendar items do not block or mutate each other automatically.

## All-Day, Cross-Midnight, Cancelled

All-day with room:

- treat as occupying the room for the full local day;
- hard against real classes in the same room;
- soft against other activities in the same room unless product later chooses stricter policy.

All-day without room:

- soft/informational only;
- must not block the whole center calendar.

Cross-midnight:

- store and compare as one real datetime interval;
- keep duration when expanding recurrence;
- an item from 22:00 to 01:00 overlaps both local dates;
- do not split into two stored records for MVP.

Cancelled:

- `isCancelled = true` does not create hard conflict;
- default behavior is no save block;
- may appear as informational context;
- if a cancelled item is restored in a later phase, conflict check must run again.

## Recurrence Strategy

Recommended strategy for F23.5E2:

```txt
master series + virtual occurrences
```

Do not materialize every occurrence as stored `centerCalendarItems`.

Why:

- current model already has `recurrenceRule`;
- weekly series can stay compact;
- edit/delete whole series is straightforward;
- no risk of orphan generated records;
- no multi-write save path in localStorage;
- tags, type, color, and description remain consistent from one master.

Tradeoff:

- range rendering and conflict checking need expansion helpers;
- occurrence id must be deterministic;
- editing one occurrence later requires an exception model, which is out of MVP.

Materializing each occurrence is not recommended for MVP because it makes whole-series edit/delete harder, inflates storage, and increases duplicate/orphan risk. It should only be reconsidered if single-occurrence editing becomes the primary product need.

## Official Recurrence Rule Shape

Use the existing `recurrenceRule` field on the master item:

```js
{
  frequency: "none" | "weekly",
  interval: 1,
  daysOfWeek: ["mon", "wed"],
  endMode: "until" | "count",
  untilDate: "2026-12-31",
  count: null,
  timezone: "Asia/Ho_Chi_Minh"
}
```

For count mode:

```js
{
  frequency: "weekly",
  interval: 1,
  daysOfWeek: ["fri"],
  endMode: "count",
  untilDate: null,
  count: 10,
  timezone: "Asia/Ho_Chi_Minh"
}
```

MVP constraints:

- `frequency`: only `none` and `weekly`;
- `interval`: fixed at `1`;
- `daysOfWeek`: one or more values from `mon` through `sun`;
- end by `untilDate` or `count`;
- cap expansion at 52 occurrences;
- no daily/monthly/custom rules;
- no holiday exceptions;
- no per-occurrence timezone;
- no single-occurrence edit/delete.

## Virtual Occurrence Identity

Virtual occurrence ids should be deterministic and non-persistent:

```txt
<masterItemId>@<local-date>
```

Example:

```txt
center-calendar-meeting-abc@2026-07-24
```

Rules:

- stable across reload;
- unique within the expanded range;
- not written back to storage as an item id;
- card/detail should know both `masterItemId` and `occurrenceDate`;
- click occurrence opens detail for the master plus the occurrence date;
- save/delete targets the master only in MVP.

## Duration And Occurrence Expansion

Master keeps:

- original `startAt`;
- original `endAt`;
- duration in milliseconds derived from those fields;
- `recurrenceRule`.

Each virtual occurrence:

- uses a local occurrence date from `daysOfWeek`;
- keeps the master start time;
- applies the same duration;
- may end on the next local date for cross-midnight activities;
- inherits item type, color, tag, location, room, cancellation state, and description from master.

Expansion must be range-bounded. TKB expands only the visible week. Save validation expands only the finite series range or up to the cap.

## Edit And Delete Series MVP

Editing a recurring activity should show:

```txt
Chỉnh sửa chuỗi hoạt động
Áp dụng cho toàn bộ chuỗi
```

Only whole-series edit is available. Do not show fake options for `chỉ lần này` or `lần này và các lần sau`.

Whole-series edit can update:

- title;
- type;
- card color;
- tag;
- time and duration;
- room/location;
- recurrence rule;
- description;
- cancellation state if that field is exposed later.

Deleting a virtual occurrence should confirm:

```txt
Xóa toàn bộ chuỗi hoạt động?
```

Delete removes the master item only. All virtual occurrences disappear because they are not persisted.

## Conflict With Recurrence

Conflict detection must compare:

- candidate single activity;
- candidate recurring master expanded into virtual occurrences;
- existing single activities;
- existing recurring masters expanded into virtual occurrences;
- class/session occurrences in the same range.

For create/edit series:

- expand candidate occurrences up to `untilDate` or `count`;
- cap at 52;
- expand existing recurring activities only across the same validation window;
- compare each occurrence with real classes and activities using the same half-open rule;
- group results by occurrence date and severity.

Warning summary should show:

- total conflicted occurrences;
- first few conflict rows;
- source type: class/session/activity;
- room/location;
- time range;
- severity.

Do not open one modal per occurrence.

## Save Flow Recommendation

F23.5E1 single-activity conflict:

1. User clicks Save.
2. Collect and validate form.
3. Normalize candidate.
4. Build read-only conflict sources for the current center.
5. Run conflict detection.
6. No conflict: save.
7. Soft conflict: show summary with `Quay lại chỉnh sửa` and `Vẫn lưu`.
8. Hard conflict with real class: block save and show only `Quay lại chỉnh sửa`.

F23.5E2 recurrence:

1. Validate recurrence rule.
2. Expand candidate virtual occurrences within finite bounds.
3. Run conflict detection for each occurrence.
4. Apply the same hard/soft policy to the whole save.
5. Save only the master if accepted.

Conflict checks should not run continuously while typing.

## Focus And Render Guard

Future implementation must preserve F23.5B.1:

- recurrence inputs/selects must not call `openModuleWindow`;
- conflict summary controls must not use `data-module-launcher`;
- ordinary field input/change must not full-render the app;
- conflict check runs on Save or explicit action only;
- returning from warning keeps form state;
- no `.focus()` workaround;
- no generic `[data-module-id]` listener.

## Center Scope

Conflict and recurrence are current-center only.

- use current resolved center for activity storage;
- use current center class/session arrays already loaded in runtime;
- do not compare across centers;
- reset expanded occurrence cache and conflict results on center switch;
- do not hardcode DreamHome.

## Out Of Scope

F23.5E0 does not implement:

- runtime code;
- UI code;
- conflict helper;
- recurrence engine;
- recurrence form;
- storage migration;
- materialized occurrences;
- exception per occurrence;
- participant/teacher/staff conflict;
- PDF/print;
- Auth/permission;
- Supabase/SQL/cloud sync;
- Teacher Portal/Workspace changes.

## Boundary With Business Modules

Activities and recurring activities remain center calendar activities. They must not:

- create `classSessions`;
- create or modify `scheduleSessions`;
- move class slots;
- change room on a class;
- create attendance records;
- create session reports;
- update `tuition.usedSessions`;
- appear in Teacher Portal as teaching sessions;
- create tuition or payroll effects.

Conflict reads real class/session data but never writes it.

## Roadmap

F23.5E1: Conflict foundation and warning for single activities.

- adapter for class/session/activity sources;
- timestamp overlap helper;
- room/location identity helper;
- hard/soft/informational summary;
- activity save gate;
- no recurrence.

F23.5E2: Weekly recurrence foundation and render.

- normalize rule shape above;
- expand master series into virtual occurrences;
- deterministic occurrence id;
- render current week;
- edit/delete whole series;
- conflict check for virtual occurrences;
- no exceptions.

F23.5E3 later: participant, teacher, and staff conflicts after a real participant picker exists.

F23.5E4 later: exception model for single-occurrence edit/delete.

## Definition Of Ready

Before F23.5E1 code:

- half-open overlap rule accepted;
- source adapters defined;
- room identity policy accepted;
- hard/soft/informational policy accepted;
- all-day/cross-midnight/cancelled policy accepted;
- class conflict blocks activity save;
- soft activity conflict can be overridden;
- focus guard plan accepted.

Before F23.5E2 code:

- master + virtual occurrence strategy accepted;
- recurrence rule shape accepted;
- `Asia/Ho_Chi_Minh` MVP timezone accepted;
- deterministic occurrence id accepted;
- 52 occurrence cap accepted;
- edit/delete whole series only accepted;
- no exception guarantee accepted.

## Marker Quyết Định

- `Cảnh báo trùng lịch` là tên nhóm cảnh báo chính.
- `Xung đột thời gian` dùng cho trường hợp overlap không chắc phòng.
- `Trùng phòng` dùng cho conflict cùng phòng hoặc cùng room id.
- `Lặp lại hàng tuần` là recurrence duy nhất ngoài không lặp.
- `Toàn bộ chuỗi` là phạm vi edit/delete duy nhất trong MVP.
- `Xóa toàn bộ chuỗi hoạt động` là copy xác nhận khi delete recurring master.
- `Quay lại chỉnh sửa` và `Vẫn lưu` là hai action cho soft conflict.

## Checks

This is a design-only document. Expected verification:

- `git diff --check`;
- docs marker/content check;
- mojibake scan for required markers;
- `npm run build` only to confirm the untouched runtime still builds.
