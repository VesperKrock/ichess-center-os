# F23.4 - Design Thời khóa biểu đa loại nội dung và thẻ màu

Ngày: 22/07/2026

Phạm vi: design-only trên `main`. Không runtime code, không UI, không Auth/Supabase/SQL/deploy, không Teacher Workspace, không push/commit.

## 1. Kết luận ngắn

Nên mở rộng Thời khóa biểu theo hướng calendar có nhiều lớp dữ liệu, nhưng giữ ranh giới học vụ thật rõ:

- `classSessions` trong Cài đặt cơ sở tiếp tục là nguồn cấu hình slot dạy cố định.
- `scheduleSessions` tiếp tục là nguồn buổi học thật: lịch cố định đã materialize, buổi học bù, học thử, buổi học đột xuất có giáo viên/học viên.
- Nội dung không phải buổi học như `meeting`, `event`, `tournament`, `other` nên dùng model riêng `centerCalendarItems[]`.

Không nên biến hội họp/sự kiện/giải đấu thành `classSession` hoặc buổi học trá hình, vì hiện Điểm danh, Học phí, Báo cáo ca dạy và Teacher Portal đều đọc các dấu hiệu học vụ như `studentIds`, `teacherId`, `classSessionId`, `scheduleSessionId`, `sessionReports.attendance`.

## 2. Audit nền hiện tại

### 2.1. Thời khóa biểu

`src/schedule-module.js` hiện render tuần từ `scheduleSessions` và `classSessions`:

- `renderScheduleModule()` nhận `sessions`, `teachers`, `students`, `weekStartDate`, `deadlineOptions.classSessions`, `deadlineOptions.attendanceRecords`.
- `scheduleTypes` hiện có `recurring` và `oneOff`.
- `+ Thêm buổi học` hiện mở form buổi học; không phải entry cho hội họp/sự kiện.
- `recurring` phải chọn `classSessionId` từ Cài đặt cơ sở; `applyClassSessionToScheduleValues()` dùng slot cấu hình để điền ngày/giờ/tên.
- `oneOff` là buổi đột xuất/học bù/học thử/học thêm theo `occurrenceReason`.
- Card TKB hiện có title, ngày/giờ, phòng, giáo viên, học viên, trạng thái, conflict.
- `getScheduleConflicts()` đang tính trùng lịch quanh buổi học hiện có.

Điểm cần chú ý: `scheduleOccurrenceReasons` đang có `event`, nhưng vì nó nằm trong `scheduleSessions`, dùng nó cho sự kiện thật sẽ dễ làm sự kiện lọt vào luồng học vụ. F23.4 đề xuất không mở rộng hướng này cho meeting/event/tournament.

### 2.2. Cài đặt cơ sở / classSessions

`src/settings-module.js` quản lý `classSessions` ở tab `Ca học / Lớp`:

- field chính: `id`, `name`, `displayLabel`, `daysOfWeek`, `daysLabel`, `startTime`, `endTime`, `note`, `status`.
- giới hạn hiện tại: tối đa 2 ngày học mỗi ca.
- `classSessions` dùng cho phân lớp học viên và lập TKB.
- xóa/ẩn phân công TKB không được xóa slot cấu hình.

Kết luận: `classSessions` là cấu hình học vụ cố định, không dùng để lưu hội họp/sự kiện.

### 2.3. Điểm danh và Học phí

`src/attendance-records.js` build attendance từ `sessionReports.attendance` và stored attendance records:

- record bắt buộc có `studentId` và `date`.
- link học vụ có thể gồm `classSessionId`, `scheduleSessionId`, `sessionId`, `teacherId`.
- counted status hiện gồm `present`, `makeup`; `countsTowardTuition !== false` mới được tính.

`src/attendance-board-module.js` đọc:

- `classSessions` để tính ngày học dự kiến;
- `sessionReports` và `attendanceRecords` để dựng ô ngày;
- `tuition.usedSessions` để hiển thị số buổi/gói.

Kết luận: meeting/event/tournament/other tuyệt đối không được sinh `studentId` attendance, không được tạo `sessionReport.attendance`, không được chạm `tuition.usedSessions`.

### 2.4. Teacher Portal / Báo cáo ca dạy

`src/teacher-module.js` đọc `scheduleSessions` có `teacherId`, `studentIds`, `classSessionId`:

- `getTeacherScheduleSessions()` lọc theo `teacherId`;
- Teacher Portal warning nếu thiếu `teacherId`, thiếu `studentIds`, thiếu `classSessionId` cho lịch cố định;
- `findSessionReportForScheduleSession()` nối report bằng `scheduleSessionId`, `sessionId` hoặc `classSessionId`.

Kết luận: hội họp có giáo viên tham gia chỉ là participant, không phải teacher assignment của lớp; không được xuất hiện như một ca dạy cần báo cáo.

## 3. Loại nội dung đề xuất

### 3.1. `fixedClass` - Dạy cố định

Nguồn: `classSessions` + lịch học thật đã materialize trong `scheduleSessions`.

Màu mặc định: xanh dương.

Được nối học vụ:

- lớp;
- giáo viên;
- học viên;
- Điểm danh;
- Báo cáo ca dạy;
- Học phí theo rule học vụ riêng.

### 3.2. `makeupClass` / `extraClass` - Học bù hoặc buổi học đột xuất

Nguồn: `scheduleSessions` nếu thật sự là buổi học.

Màu mặc định: vàng.

Có thể nối Điểm danh/Báo cáo ca dạy khi đủ học viên, giáo viên, thời gian và session identity. Không tự nối Học phí nếu chưa có phase rule riêng.

### 3.3. `meeting` - Hội họp

Nguồn đề xuất: `centerCalendarItems[]`.

Màu mặc định: cam.

Ví dụ:

- họp giáo viên;
- họp nhân viên;
- họp phụ huynh;
- họp nội bộ.

Không tạo Điểm danh học viên, Học phí hoặc Báo cáo ca dạy.

### 3.4. `event` - Sự kiện

Nguồn đề xuất: `centerCalendarItems[]`.

Màu mặc định: xanh lá.

Ví dụ: workshop, ngày hội, giao lưu, hoạt động cơ sở.

Không tự tạo lớp học, điểm danh, học phí hoặc báo cáo ca dạy.

### 3.5. `tournament` - Giải đấu

Khuyến nghị để `tournament` là type riêng nếu iChess cần filter/report giải đấu; nếu muốn model gọn có thể dùng `itemType: "event"` và `itemSubtype: "tournament"`.

F23.5 nên chọn type riêng `tournament` vì user đã gọi rõ “giải đấu”, khả năng cần in/legend/filter riêng cao.

Màu mặc định: xanh lá, có thể dùng sắc xanh đậm hơn event thường.

### 3.6. `other` - Hoạt động khác

Nguồn đề xuất: `centerCalendarItems[]`.

Màu mặc định: vàng hoặc xám.

Bắt buộc có `title`. Không có nối học vụ mặc định.

## 4. Data model đề xuất

### 4.1. Model riêng

Đề xuất tạo store/model riêng trong phase code sau:

```txt
centerCalendarItems[]
{
  id,
  centerId,
  itemType: "meeting" | "event" | "tournament" | "other",
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
  createdBy,
  createdAt,
  updatedAt,
  recurrenceRule,
  recurrenceExceptions,
  sourceModule: "center-calendar",
  linkedSessionId,
  linkedClassSessionId,
  isCancelled
}
```

### 4.2. Vì sao không dùng chung scheduleSessions?

Không dùng chung cho meeting/event/tournament vì `scheduleSessions` hiện đã nằm trong luồng học vụ:

- có `teacherId`;
- có `studentIds`;
- có `classSessionId`;
- có report/attendance/deadline adapter;
- được Teacher Portal hiểu như ca dạy.

Nếu dùng chung model schedule, phải thêm discriminator và guard rất mạnh. Rủi ro lớn hơn lợi ích. Model riêng giúp tránh việc chỉ vì event có màu xanh hoặc có `teacherIds` mà hệ thống coi là buổi học.

### 4.3. Ranh giới dữ liệu

Không đổi:

- `classSessions`: cấu hình slot dạy cố định từ Cài đặt cơ sở.
- `scheduleSessions`: buổi học thật hoặc học bù/học thử/đột xuất có học viên.
- `sessionReports`: báo cáo ca dạy cho buổi học thật.
- `attendanceRecords`: điểm danh theo học viên/ngày/session.
- `tuition`: học phí, không tự cập nhật từ calendar item.

Thêm sau:

- `centerCalendarItems`: nội dung không phải lớp học.
- `centerCalendarTags`: thẻ màu custom.

## 5. Màu và thẻ màu

### 5.1. Preset theo loại

| Loại | Key | Màu mặc định | Ghi chú |
| --- | --- | --- | --- |
| Dạy cố định | `fixedClass` | xanh dương | vẫn từ classSessions/scheduleSessions |
| Học bù / buổi học đột xuất | `makeupClass` | vàng | chỉ khi là buổi học thật |
| Hội họp | `meeting` | cam | không nối học vụ |
| Sự kiện | `event` | xanh lá | không nối học vụ |
| Giải đấu | `tournament` | xanh lá đậm | không nối học vụ mặc định |
| Hoạt động khác | `other` | vàng hoặc xám | không nối học vụ |

Màu chỉ là hiển thị, không quyết định nghiệp vụ.

### 5.2. Custom tag kiểu Trello

Model đề xuất:

```txt
centerCalendarTags[]
{
  id,
  centerId,
  label,
  color,
  defaultItemType,
  description,
  isActive,
  createdAt,
  updatedAt
}
```

Nguyên tắc:

- Tag có thể đổi màu/label nhưng không đổi type nghiệp vụ.
- Meeting màu tím vẫn là `meeting`, không trở thành lớp học.
- MVP dùng palette giới hạn để đảm bảo contrast.
- Có legend màu trên TKB.
- Có filter theo type và tag.

## 6. UI trên grid TKB

Grid tuần nên hiển thị nhiều lớp item:

1. Slot dạy cố định từ classSessions/scheduleSessions như hiện tại.
2. Buổi học bù/học thử/đột xuất từ scheduleSessions.
3. Calendar item từ centerCalendarItems.

Card cần có:

- màu/tag;
- label type, không chỉ màu;
- tiêu đề;
- thời gian;
- phòng/địa điểm;
- người phụ trách/người tham gia nếu có;
- trạng thái hủy nếu có.

Click behavior:

- Buổi học mở detail/form buổi học hiện tại.
- Meeting/event/tournament/other mở detail calendar item riêng.
- Không dùng chung form nếu field học vụ có thể gây hiểu nhầm.

Action đề xuất:

- Giữ `+ Thêm buổi học` cho buổi học đột xuất/học bù.
- Thêm `+ Thêm hoạt động` hoặc menu `+ Thêm` gồm: Buổi học, Hội họp, Sự kiện, Giải đấu, Hoạt động khác.

## 7. Recurrence

Không dùng `classSessions` để mô phỏng recurrence của event.

MVP:

- không lặp;
- lặp hàng tuần;
- ngày kết thúc hoặc số lần.

Later:

- hàng ngày;
- hàng tháng;
- ngày tùy chọn;
- ngoại lệ từng occurrence;
- sửa một lần/sửa cả chuỗi.

Model `recurrenceRule` có thể dùng shape gọn:

```txt
{
  frequency: "none" | "weekly",
  interval: 1,
  byWeekday: ["mon"],
  untilDate,
  count
}
```

## 8. Conflict và cảnh báo trùng lịch

Conflict nên dùng chung khái niệm nhưng không để event sửa assignment lớp.

Loại cảnh báo:

- trùng phòng;
- trùng giáo viên;
- trùng staff participant;
- trùng giờ với lớp dạy;
- sự kiện chồng nhiều slot.

Mức độ:

- hard conflict: cùng giáo viên dạy hai lớp thật cùng giờ.
- soft warning: phòng đang có event/meeting khác.
- informational: participant có lịch khác.

MVP nên cảnh báo và cho user xác nhận, chưa cần chặn mọi conflict.

## 9. Permission

Design dài hạn:

- `owner`, `center_admin`, `qtv`: tạo/sửa/xóa mọi calendar item trong cơ sở.
- `consultant`: tạo hoạt động được cấp quyền; không sửa slot lớp.
- `teacher`: xem lịch liên quan; quyền tạo/sửa meeting/event để phase sau.
- viewer/read-only: chỉ xem.

F23.5 local-safe chưa cần Auth/permission thật nếu chưa approved. Không SQL/Supabase trong F23.4.

## 10. Ranh giới với học vụ

Tuyệt đối không cho `meeting`, `event`, `tournament`, `other`:

- tạo `classSession`;
- tạo `scheduleSession` học vụ;
- có `isTeachingSession === true`;
- sinh `sessionReports`;
- sinh `attendanceRecords`;
- xuất hiện trong Teacher Portal như ca dạy;
- tác động Học phí;
- update `tuition.usedSessions`.

Calendar item có thể có `teacherIds` hoặc `participantIds`, nhưng đó là participant, không phải teacher assignment.

Nếu cần link một event tới buổi học thật, chỉ dùng link read-only như `linkedSessionId`; không tự biến event thành session.

## 11. Filter, legend và print/PDF

Filter TKB:

- Tất cả;
- Buổi học;
- Học bù;
- Hội họp;
- Sự kiện;
- Giải đấu;
- Hoạt động khác;
- Theo tag custom.

Legend:

- hiển thị màu preset/tag;
- có label text cho accessibility.

Xuất PDF theo tuần ở F23.6:

- đọc cùng nguồn dữ liệu tuần;
- giữ màu/tag;
- có legend;
- tùy chọn chỉ in buổi học hoặc tất cả hoạt động;
- có tên cơ sở, khoảng ngày, timestamp xuất;
- ưu tiên A4 ngang;
- không phụ thuộc screenshot thô nếu có thể.

Không code PDF trong F23.4.

## 12. Backward compatibility

F23.5/F23.6 phải giữ:

- dữ liệu TKB hiện có không rewrite;
- fixed slot cũ vẫn render từ `classSessions`;
- schedule/session cũ vẫn hoạt động;
- không migrate meeting/event bằng đoán title;
- không đổi ID session cũ;
- không đổi attendance adapter;
- không đổi `tuition.usedSessions`.

## 13. Roadmap

### F23.5A - Data foundation local-safe

- thêm model `centerCalendarItems[]` và `centerCalendarTags[]`;
- normalize/storage local-safe;
- chưa render lớn.

### F23.5B - Render read-only trên TKB

- overlay calendar item vào grid tuần;
- label type + màu/tag;
- detail read-only riêng.

### F23.5C - Form tạo/sửa/xóa calendar item

- action `+ Thêm hoạt động`;
- form riêng cho meeting/event/tournament/other;
- không đụng `+ Thêm buổi học`.

### F23.5D - Preset màu + custom tag

- palette an toàn;
- tag active/archived;
- filter theo tag.

### F23.5E - Conflict warning, filter, legend

- warning trùng phòng/giáo viên/participant;
- filter type/tag;
- legend màu.

### F23.6 - Xuất PDF theo tuần

- print preview;
- PDF export;
- chọn scope: chỉ buổi học hoặc tất cả hoạt động.

## 14. Definition of Ready cho F23.5

Trước khi code cần chốt:

- type list chính thức;
- `tournament` riêng hay subtype event;
- palette preset;
- custom tag palette/contrast;
- recurrence MVP có làm ngay hay chỉ single item;
- conflict nào hard/soft/info;
- permission local MVP;
- calendar item nào Teacher Portal được thấy ở read-only;
- ranh giới tuyệt đối với Điểm danh, Học phí, Báo cáo ca dạy.

## 15. Checks

Tài liệu này là design-only. Không có runtime code, không có UI, không có storage key thật.

Checks cần chạy:

- `git diff --check`
- Scan tài liệu với bộ marker mojibake bắt buộc trong prompt.
- `npm run build`
