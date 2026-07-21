# F23.2 - Design nối dây Phụ huynh ↔ Tư vấn ↔ Học viên

Ngày: 21/07/2026

Phạm vi: design-only trên `main`. Không runtime code, không UI, không Auth/Supabase/SQL/deploy, không Teacher Workspace, không push/commit.

## 1. Kết luận ngắn

Nên xem Module Phụ huynh/Tư vấn là CRM nhẹ cho khách hàng gia đình. CRM này quản lý hành trình từ người liên hệ mới đến phụ huynh/học viên thật, còn Module Học viên vẫn là hồ sơ học tập chính và Module Học phí chỉ đọc học viên/phụ huynh đã liên kết.

Ba loại khách hàng nên dùng cho iChess giai đoạn hiện tại:

1. `lead` - Khách mới: có thông tin liên hệ, chưa chắc có học viên trong hệ thống.
2. `consulting` - Khách đang tư vấn/học thử: đã được tư vấn viên theo dõi, có ghi chú, lịch hẹn hoặc nhu cầu rõ hơn.
3. `converted` - Đã chuyển đổi: đã tạo/ghép phụ huynh và ít nhất một hồ sơ học viên thật.

Các trạng thái như đang học, bảo lưu, ngưng, chờ phản hồi không nên là “loại khách hàng” chính. Chúng nên là `status`/`relationshipStatus` riêng để không trộn funnel bán hàng với trạng thái vận hành sau đăng ký.

## 2. Audit hiện trạng

### 2.1. File đã audit

- `src/student-module.js`
- `src/student-detail.js`
- `src/student-data.js`
- `src/parent-consultation-module.js`
- `src/parent-consultation-data.js`
- `src/tuition-module.js`
- `src/main.js`
- `src/storage.js`
- `src/styles.css`

Repo hiện không có `src/parent-module.js` hoặc `src/consultant-module.js` riêng. Module tương ứng hiện là `parent-consultation-module.js`.

### 2.2. Học viên đang lưu phụ huynh ở đâu?

Hồ sơ học viên hiện lưu phụ huynh trực tiếp dạng text:

```txt
student.parentName
student.fatherPhone
student.motherPhone
student.parentPhone
student.parentBirthYear
student.parentJob
student.parentArea
student.parentNotes
student.careNotes
student.latestCareNote
```

Chưa thấy `parentId`, `parentIds`, `consultantId`, `consultantName` là quan hệ chuẩn trên `student`.

`storage.js` normalize học viên theo hướng giữ `fatherPhone`, `motherPhone`, `parentPhone`; nếu chưa có `careNotes` thì migrate `latestCareNote` cũ thành một note legacy. Đây là nền tốt để reuse ghi chú chăm sóc, nhưng chưa giải quyết định danh phụ huynh.

### 2.3. Phụ huynh/Tư vấn hiện có dữ liệu gì?

`parent-consultation-data.js` và `parent-consultation-module.js` đã có CRM local tương đối rõ:

```txt
contactType:
  currentParent
  consultingLead
  reservedParent
  stoppedParent

consultationStatus:
  activeCare
  newLead
  waitingResponse
  trialScheduled
  pendingEnrollment
  converted
  paused
  closed

source:
  parentReferral
  facebook
  zalo
  walkIn
  school
  oldStudent
  website
  eventTournament
  unknown
```

Contact hiện có các field quan trọng: `parentName`, `phone`, `secondaryPhone`, `email`, `studentId`, `studentName`, `leadStudentName`, `leadStudentAge`, `studentBirthYear`, `leadNeed`, `parentFeedbackAboutChild`, `interestedProgram`, `preferredSchedule`, `locationArea`, `lastNote`, `nextAction`, `careLogs`, `appointments`, `enrollmentDraft`.

Điểm mạnh: đã có wizard, care log, appointment, enrollment draft, merge contact với học viên, và có derived contacts từ `students`.

Điểm thiếu: chưa có tư vấn phụ trách dạng id (`consultantId`), chưa có parent entity chuẩn, chưa có convert preview an toàn từ lead sang parent/student, và quan hệ phụ huynh-học viên vẫn dựa nhiều vào phone/text.

### 2.4. Học phí đang đọc phụ huynh/học viên ra sao?

`tuition-module.js` build row từ `students` và `tuitionRecords`. Học phí đọc:

```txt
row.student.fullName
row.student.parentName
row.student.parentPhone
row.student.fatherPhone
row.student.motherPhone
row.student.careNotes
tuitionRecord.studentId
```

F23.1 đã thêm ghi chú Học phí vào `students[].careNotes` với `sourceModule: "tuition"`. Đây là đúng hướng: ghi chú chăm sóc có thể dùng chung giữa Học phí và Học viên theo `studentId`.

Học phí không nên tự tạo phụ huynh/học viên và không nên tự update học phí khi chuyển lead. Học phí chỉ nên đọc quan hệ đã chuẩn hóa.

### 2.5. Rủi ro trùng dữ liệu

Rủi ro hiện tại là cùng một phụ huynh có thể nằm ở nhiều nơi:

- text trong nhiều `students[]`;
- một hoặc nhiều `parentConsultations[]`;
- derived contact sinh từ học viên theo phone/name fallback;
- ghi chú trong `student.careNotes`;
- care log riêng trong `contact.careLogs`.

Số điện thoại có thể giúp dedupe nhưng không tuyệt đối: một phụ huynh có nhiều số, hai phụ huynh dùng chung số, hoặc học viên có cả số ba/mẹ.

## 3. Định nghĩa nghiệp vụ

### 3.1. Khách mới / Lead

Người liên hệ mới, chưa chắc là phụ huynh chính thức, chưa chắc có học viên trong hệ thống.

Data tối thiểu:

- tên người liên hệ;
- số điện thoại chính;
- nguồn khách;
- nhu cầu học;
- tên/tuổi bé nếu có;
- khu vực;
- tư vấn phụ trách nếu đã gán;
- ghi chú chăm sóc.

### 3.2. Khách đang tư vấn

Lead đã có hoạt động chăm sóc thật: gọi điện, Zalo, lịch hẹn, học thử, chờ phản hồi hoặc draft đăng ký.

Data tối thiểu:

- toàn bộ data lead;
- `consultantId`;
- trạng thái follow-up;
- lịch hẹn hoặc học thử;
- care logs;
- next action;
- mức độ sẵn sàng đăng ký.

### 3.3. Phụ huynh

Người đại diện/chăm sóc học viên, có thể liên kết một hoặc nhiều học viên. Phụ huynh là customer/contact đã đủ tin cậy để trở thành hồ sơ gia đình chính thức.

Data tối thiểu:

- `parentId`;
- tên;
- phone/email;
- danh sách học viên liên kết;
- ghi chú chăm sóc;
- tư vấn phụ trách ban đầu hoặc hiện tại.

### 3.4. Học viên thật

Hồ sơ học tập chính trong hệ thống. Chỉ khi có học viên thật thì mới nên đi tiếp sang lớp học, điểm danh, học phí.

Data tối thiểu:

- `studentId`;
- `primaryParentId` hoặc `parentIds`;
- `initialConsultantId` nếu cần attribution;
- lớp/ca học;
- giáo viên phụ trách;
- học phí;
- care notes chung.

## 4. Đề xuất data model

### 4.1. Chọn `contacts[]` làm CRM pipeline trước

Trong local-safe phase, nên dùng một model CRM chung:

```txt
contacts[] / parentConsultations[]
{
  id,
  customerStage: "lead" | "consulting" | "converted",
  relationshipStatus: "new" | "waiting" | "trial" | "active" | "reserved" | "stopped" | "closed",
  contactType,
  parentName,
  phone,
  secondaryPhone,
  email,
  source,
  locationArea,
  interestedProgram,
  preferredSchedule,
  leadStudentName,
  leadStudentAge,
  studentBirthYear,
  leadNeed,
  consultantId,
  consultantName,
  primaryParentId,
  linkedStudentIds,
  careLogs,
  appointments,
  enrollmentDraft,
  createdAt,
  updatedAt
}
```

Lý do chọn model chung:

- ít migration hơn vì repo đã có `parentConsultations`;
- giữ được khách chưa chuyển đổi và phụ huynh đã chuyển đổi trong cùng CRM;
- phù hợp F23.3 làm UI shell/local-safe trước;
- dễ giữ lịch sử tư vấn khi convert.

Không nên tách ngay `leads[]` và `parents[]` trong F23.3 vì sẽ cần nhiều migration và dễ tạo hai nguồn sự thật. Khi lên cloud/RLS sau này có thể tách `parents` thành entity riêng nếu quyền/phân quyền cần rõ hơn.

### 4.2. Parent entity chuẩn

Về lâu dài nên có parent identity:

```txt
parents[]
{
  id,
  fullName,
  phone,
  secondaryPhones,
  email,
  area,
  job,
  careNotes,
  consultantId,
  createdFromContactId,
  createdAt,
  updatedAt
}
```

Nhưng F23.3 nên đi theo hướng preview/local-safe:

- chưa bắt buộc tạo `parents[]` nếu chưa có migration;
- có thể thêm `primaryParentId`/`linkedParentId` vào contact và student sau khi design chi tiết;
- dedupe bằng phone chỉ là gợi ý, không tự merge cứng.

### 4.3. Quan hệ Phụ huynh - Học viên

Khuyến nghị phase đầu:

```txt
student.primaryParentId
student.parentIds = []
contact.linkedStudentIds = []
```

Lý do:

- `primaryParentId` đủ đơn giản cho 80% case;
- `parentIds[]` mở đường cho ba/mẹ/người đưa đón;
- `linkedStudentIds` giúp CRM xem một phụ huynh có nhiều con;
- vẫn giữ `parentName`, `fatherPhone`, `motherPhone`, `parentPhone` legacy để UI cũ không vỡ.

Không nên xóa field text hiện tại trong phase đầu. Chỉ nên coi chúng là denormalized display/cache sau khi có id chuẩn.

### 4.4. Quan hệ Tư vấn - Khách hàng/Học viên

Khuyến nghị:

```txt
contact.consultantId
contact.consultantName
parent.consultantId
student.initialConsultantId
student.currentConsultantId
```

`contact.consultantId` là nguồn chính trong CRM. Khi convert sang học viên, copy sang `student.initialConsultantId` để giữ attribution. `currentConsultantId` chỉ dùng nếu iChess muốn chăm sóc dài hạn bởi tư vấn khác sau đăng ký.

Không nên trộn tư vấn với giáo viên. Tư vấn nên là staff/member role riêng, liên quan tới C7 quyền sau này.

## 5. Flow chuyển đổi đề xuất

### 5.1. Lead → Khách đang tư vấn

```txt
Tạo khách mới
→ nhập parentName/phone/source/leadNeed
→ gán consultantId
→ thêm care log hoặc lịch hẹn
→ customerStage = "consulting"
→ relationshipStatus = "waiting" hoặc "trial"
```

Không tạo học viên, không tạo học phí.

### 5.2. Khách đang tư vấn → Phụ huynh

```txt
Khách đủ thông tin
→ mở convert preview
→ gợi ý parent trùng theo phone
→ chọn "ghép phụ huynh có sẵn" hoặc "tạo phụ huynh mới"
→ giữ careLogs/appointments/enrollmentDraft
→ customerStage = "converted"
```

Không tự merge theo phone nếu người dùng chưa xác nhận.

### 5.3. Phụ huynh → Học viên

```txt
Từ contact/parent đã converted
→ tạo hoặc ghép student
→ set primaryParentId / linkedStudentIds
→ copy display field legacy cần thiết
→ student.currentStatus = "Đang theo học" hoặc trạng thái học thử nếu có
```

Chưa tạo học phí tự động. Học phí chỉ bắt đầu khi admin gán gói học phí thủ công như hiện tại.

### 5.4. Học thử → Đang học

```txt
consulting lead
→ appointment trialLesson
→ sau học thử đánh dấu pendingEnrollment
→ convert preview tạo parent/student
→ nếu đăng ký thật: admin sang Học phí gán gói
```

Học thử có thể có student draft hoặc guest appointment, nhưng không nên làm thành học viên học phí thật cho tới khi convert.

## 6. Ghi chú/chăm sóc

Hiện có hai dòng ghi chú:

- `student.careNotes`: dùng trong Module Học viên và Học phí F23.1.
- `contact.careLogs`: dùng trong Module Phụ huynh/Tư vấn.

Khuyến nghị phase đầu:

- giữ cả hai, không migration phá vỡ;
- khi contact đã linked với student, CRM có thể hiển thị timeline hợp nhất read-only: `contact.careLogs` + `student.careNotes`;
- khi thêm note ở Học phí/Học viên, note vẫn lưu vào `student.careNotes`;
- khi thêm note ở CRM trước convert, note lưu vào `contact.careLogs`;
- khi convert, không copy trùng toàn bộ careLogs sang student, chỉ liên kết timeline bằng id.

Về sau nếu cần chuẩn hóa sâu, có thể thiết kế `careNotes[]` chung:

```txt
{
  id,
  ownerType: "contact" | "parent" | "student",
  ownerId,
  relatedStudentIds,
  sourceModule,
  authorId,
  content,
  tags,
  createdAt,
  updatedAt
}
```

Chưa nên làm entity chung trong F23.3 nếu chưa có approval về migration/cloud.

## 7. Ảnh hưởng theo module

### 7.1. Module Phụ huynh/Tư vấn

Nên trở thành CRM nhẹ:

- danh sách khách hàng/phụ huynh;
- 3 stage khách hàng;
- tư vấn phụ trách;
- ghi chú chăm sóc;
- lịch hẹn/học thử;
- convert preview sang parent/student;
- xem học viên liên kết;
- xem tóm tắt học phí sau khi đã linked.

Điểm cần đổi ở phase sau: `contactType` hiện có 4 loại nên nên giữ để tương thích, nhưng thêm `customerStage` 3 loại để trả lời feedback anh Hải rõ hơn.

### 7.2. Module Học viên

Học viên vẫn là hồ sơ học tập chính. Phase sau nên:

- thêm quan hệ `primaryParentId`/`parentIds`;
- vẫn giữ display fields legacy;
- hiển thị nguồn tạo hồ sơ nếu từ CRM convert;
- hiển thị tư vấn ban đầu nếu có;
- đọc timeline chăm sóc hợp nhất khi cần.

### 7.3. Module Học phí

Học phí không tạo customer. Học phí nên:

- đọc `studentId` như hiện tại;
- đọc phụ huynh chuẩn qua `student.primaryParentId` khi có;
- fallback về `student.parentName/parentPhone` legacy;
- tiếp tục lưu note học phí vào `student.careNotes`;
- không tự update `tuition.usedSessions`;
- không tự tạo học phí khi convert lead.

### 7.4. Staff/Consultant

Tư vấn nên gắn với staff/member id, không phải teacher. Cần thiết kế quyền C7 trước khi bật write cloud thật cho role consultant.

## 8. Rủi ro và guard

1. Dữ liệu phụ huynh hiện có thể đang lưu text trong nhiều học viên.
2. Phone dedupe hữu ích nhưng không đủ an toàn để auto merge.
3. Một phụ huynh có thể có nhiều học viên; một học viên có thể có nhiều người chăm sóc.
4. Convert lead sang student có thể chạm lịch học/học phí nếu làm quá tay.
5. Nếu copy careLogs sang student.careNotes có thể tạo trùng timeline.
6. Consultant role liên quan phân quyền, không nên làm SQL/Supabase khi chưa có approval.
7. Không nên đổi công thức Học phí hoặc attendance-to-tuition trong pipeline này.
8. Không nên sửa Teacher Workspace/secret branch.

## 9. Roadmap đề xuất sau F23.2

### F23.3A - Design chi tiết CRM Phụ huynh/Tư vấn

Chốt field `customerStage`, `relationshipStatus`, `consultantId`, `linkedStudentIds`, `primaryParentId`, dedupe rule và convert preview.

### F23.3B - UI shell read-only/local-safe

Hiển thị 3 stage khách hàng trong Module Phụ huynh/Tư vấn, không migration lớn, không cloud.

### F23.3C - Form khách mới local-safe

Cho tạo lead với `customerStage = "lead"` và gán tư vấn phụ trách nếu đã có staff phù hợp.

### F23.3D - Convert preview

Tạo màn preview chuyển lead → parent/student:

- gợi ý trùng phone;
- chọn tạo mới hoặc ghép;
- không ghi Học phí;
- không tạo lịch học bắt buộc;
- giữ careLogs.

### F23.3E - Nối Học viên/Học phí đọc parentId chuẩn

Học viên có `primaryParentId`; Học phí đọc parent chuẩn nếu có, fallback legacy nếu chưa có.

### F23.3F - Timeline hợp nhất

Thiết kế/triển khai timeline read-only hợp nhất giữa `contact.careLogs` và `student.careNotes`.

## 10. Definition of Ready cho code phase

Trước khi code runtime, cần chốt:

- dùng `customerStage` hay rename khác;
- parent identity có tạo ngay không hay chỉ dùng contact trước;
- consultant lấy từ staff, membership hay danh sách riêng;
- dedupe phone có rule review thủ công như thế nào;
- convert có tạo student ngay hay tạo draft trước;
- note CRM có cần xuất hiện trong Học viên ngay hay chỉ khi linked;
- cloud/RLS có nằm ngoài scope local-safe không.

## 11. Không làm trong F23.2

- Không runtime code.
- Không sửa UI.
- Không sửa Module Học phí/Học viên/Phụ huynh-Tư vấn runtime.
- Không tạo data thật.
- Không Auth/Supabase/SQL/deploy.
- Không Teacher Workspace.
- Không push/commit.
