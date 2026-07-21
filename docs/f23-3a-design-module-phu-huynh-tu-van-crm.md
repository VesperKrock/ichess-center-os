# F23.3A - Design Module Phụ huynh-Tư vấn CRM nhẹ

Ngày: 21/07/2026

Phạm vi: design-only trên `main`. Không runtime code, không UI, không Auth/Supabase/SQL/deploy, không Teacher Workspace, không push/commit.

## 1. Mục tiêu

F23.3A chi tiết hóa hướng F23.2 thành thiết kế Module Phụ huynh-Tư vấn dạng CRM nhẹ, chuẩn bị cho F23.3B local-safe MVP.

Module này cần quản lý:

- danh sách khách hàng/phụ huynh;
- 3 loại khách hàng `lead`, `consulting`, `converted`;
- hồ sơ khách hàng;
- tư vấn phụ trách;
- ghi chú chăm sóc;
- lịch hẹn/học thử;
- liên kết học viên;
- flow chuyển đổi lead → phụ huynh/học viên;
- liên thông đọc với Học viên/Học phí sau khi đã linked.

## 2. Audit hiện trạng

Repo hiện không có `src/parent-module.js` riêng. Module đang làm vai trò Phụ huynh/Tư vấn là:

```txt
src/parent-consultation-module.js
src/parent-consultation-data.js
```

Storage local-safe đã có:

```txt
parentConsultations
careLogs
appointments
enrollmentDraft
```

`src/storage.js` đã có key `PARENT_CONSULTATIONS_KEY`, normalize `parentConsultations`, validate `contactType`, `consultationStatus`, `source`, care logs, appointments và enrollment draft.

Học viên hiện lưu thông tin phụ huynh bằng field text:

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
```

Học phí hiện đọc phụ huynh/học viên qua `studentId` và các field text của student. F23.1 đã thêm ghi chú Học phí vào `student.careNotes`, dùng chung với Học viên theo `studentId`.

Role `consultant` đã xuất hiện trong một số phần quyền/cloud docs/code label, nhưng Module Phụ huynh/Tư vấn local hiện chưa có `consultantId` chuẩn trên contact. Enrollment draft hiện có `advisorName`, phù hợp làm fallback hiển thị trong MVP.

## 3. Nguyên tắc thiết kế

1. Reuse module hiện có: mở rộng `parentConsultations`, không tạo module mới nếu không cần.
2. Thêm `customerStage` để trả lời 3 loại khách hàng, giữ `contactType` cũ để tương thích.
3. Không auto merge phụ huynh theo số điện thoại; chỉ gợi ý dedupe.
4. Không convert thật sang học viên/học phí trong F23.3B.
5. Không copy trùng care log sang `student.careNotes`; khi linked thì timeline có thể hợp nhất read-only.
6. Học phí chỉ đọc quan hệ đã chuẩn hóa, không tự tạo customer/học viên.
7. Consultant là người phụ trách tư vấn, không phải giáo viên phụ trách học tập.

## 4. Ba loại khách hàng chốt cho MVP

### 4.1. `lead` - Khách mới

Người mới liên hệ, chưa chắc thành phụ huynh chính thức và chưa chắc có học viên trong hệ thống.

Điều kiện gợi ý:

- có `parentName` hoặc `phone`;
- `consultationStatus` thường là `newLead`;
- chưa có `linkedStudentIds`;
- chưa có lịch hẹn học thử hoặc enrollment draft sẵn sàng.

Nhãn UI: `Khách mới`.

### 4.2. `consulting` - Đang tư vấn

Khách đang được tư vấn viên theo dõi, có hoạt động chăm sóc, lịch hẹn, học thử, chờ phản hồi hoặc draft đăng ký.

Điều kiện gợi ý:

- có `consultantId`, `consultantName` hoặc `advisorName`;
- có `careLogs`, `appointments`, `nextFollowUpAt`, `nextAction`;
- `consultationStatus` thuộc `waitingResponse`, `trialScheduled`, `pendingEnrollment`, `activeCare`;
- chưa converted hoàn toàn.

Nhãn UI: `Đang tư vấn`.

### 4.3. `converted` - Đã chuyển đổi

Khách đã trở thành phụ huynh/học viên thật.

Điều kiện gợi ý:

- có `linkedParentId` hoặc `studentId`/`linkedStudentIds`;
- `consultationStatus` là `converted` hoặc contact được ghép với học viên thật;
- có thể xem học viên liên kết và sau này xem tóm tắt học phí.

Nhãn UI: `Đã chuyển đổi`.

## 5. Data model đề xuất

F23.3B nên tiếp tục dùng `parentConsultations[]`, thêm field mới theo cách backward-compatible.

```txt
parentConsultations[]
{
  id,
  centerId,
  customerStage: "lead" | "consulting" | "converted",
  relationshipStatus,
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
  parentFeedbackAboutChild,
  consultantId,
  consultantName,
  advisorName,
  followUpStatus,
  nextFollowUpAt,
  nextAction,
  potentialLevel,
  linkedParentId,
  linkedStudentIds,
  studentId,
  studentName,
  careLogs,
  appointments,
  enrollmentDraft,
  createdAt,
  updatedAt
}
```

### 5.1. Field bắt buộc trong MVP

```txt
id
customerStage
parentName hoặc phone
source
consultationStatus
createdAt
updatedAt
```

Nếu tạo khách mới mà thiếu tên, vẫn có thể lưu nếu có số điện thoại. Nếu thiếu cả tên và số điện thoại thì không nên lưu.

### 5.2. Field nên có trong MVP

```txt
leadStudentName
leadStudentAge hoặc studentBirthYear
leadNeed
interestedProgram
preferredSchedule
consultantName
nextAction
careLogs
appointments
```

`consultantName` có thể dùng trước khi có `consultantId` chuẩn.

### 5.3. Field defer

```txt
linkedParentId
primaryParentId
parentIds
consultantId thật
potentialLevel scoring
nextFollowUpAt notification thật
linkedStudentIds write thật
```

Các field này có thể xuất hiện trong docs/model nhưng F23.3B không cần write thật nếu chưa có phase convert.

## 6. Mapping với model hiện có

### 6.1. `contactType` cũ

Giữ để không phá dữ liệu:

```txt
currentParent
consultingLead
reservedParent
stoppedParent
```

Mapping gợi ý sang `customerStage`:

```txt
consultingLead + newLead                  → lead
consultingLead + waiting/trial/pending    → consulting
currentParent                             → converted
reservedParent/stoppedParent có studentId → converted
consultationStatus converted              → converted
closed chưa studentId                     → lead hoặc consulting với status closed
```

Không dùng mapping này để auto rewrite trong design phase; chỉ dùng cho render/derive ở F23.3B nếu cần.

### 6.2. `consultationStatus` cũ

Giữ làm trạng thái vận hành:

```txt
newLead
waitingResponse
trialScheduled
pendingEnrollment
activeCare
converted
paused
closed
```

`customerStage` trả lời khách đang ở chặng nào của funnel. `consultationStatus` trả lời việc đang cần làm là gì.

### 6.3. Ghi chú

CRM trước convert dùng:

```txt
contact.careLogs[]
```

Học viên/Học phí dùng:

```txt
student.careNotes[]
```

Khi đã linked, detail CRM có thể hiển thị timeline hợp nhất read-only:

```txt
contact.careLogs + linkedStudents[].careNotes
```

F23.3B chưa cần migration note chung.

## 7. UI design

### 7.1. Màn danh sách

Màn chính nên là workspace CRM thực dụng, không landing page.

Khu vực trên cùng:

- search theo tên phụ huynh, số điện thoại, tên bé, nhu cầu, ghi chú;
- segmented filter 3 stage: `Khách mới`, `Đang tư vấn`, `Đã chuyển đổi`;
- filter tư vấn phụ trách;
- filter trạng thái follow-up;
- filter nguồn khách;
- nút `+ Thêm khách mới`.

Stats gọn:

- tổng khách;
- khách mới;
- đang tư vấn;
- cần follow-up;
- đã chuyển đổi.

Row/table nên có:

- tên khách/phụ huynh;
- phone;
- stage badge;
- consultation status;
- tư vấn phụ trách;
- nguồn;
- nhu cầu/chương trình quan tâm;
- next action / hẹn gọi lại;
- số học viên liên kết;
- badge ghi chú.

### 7.2. Detail khách hàng

Click row mở detail/window trong module.

Các section trong detail:

1. Tổng quan liên hệ:
   - tên;
   - phone;
   - email;
   - khu vực;
   - nguồn.
2. Funnel:
   - `customerStage`;
   - `consultationStatus`;
   - potential level nếu có;
   - next action.
3. Tư vấn phụ trách:
   - consultantName;
   - consultantId nếu có;
   - lịch sử gán tư vấn về sau nếu cần.
4. Bé/học viên quan tâm:
   - leadStudentName;
   - tuổi/năm sinh;
   - nhu cầu;
   - chương trình quan tâm;
   - lịch mong muốn.
5. Ghi chú chăm sóc:
   - timeline care logs;
   - form thêm ghi chú;
   - chip gợi ý.
6. Lịch hẹn:
   - consultation;
   - trialLesson;
   - callback;
   - followUp.
7. Học viên liên kết:
   - danh sách linked students nếu converted;
   - action mở detail học viên;
   - tóm tắt học phí read-only về sau.
8. Convert preview:
   - chỉ hiển thị CTA/preview trong F23.3B, chưa convert thật nếu chưa có phase.

### 7.3. Ghi chú chăm sóc

Pattern nên giống Học viên/Học phí:

- lịch sử ghi chú dạng timeline;
- form thêm ghi chú;
- tag/chủ đề;
- chip gợi ý;
- nút lưu;
- trạng thái lưu.

Chip gợi ý cho tư vấn:

```txt
Cần gọi lại
Đã tư vấn học thử
Phụ huynh quan tâm học phí
Cần gửi lịch học
Cần gửi bảng phí
Đã hẹn đến trung tâm
Chưa nghe máy
Cần tư vấn gói học
Đã chuyển thành học viên
```

Trong MVP, note CRM nên lưu vào `contact.careLogs` để không tạo trùng note học viên.

## 8. Flow chuyển đổi

### 8.1. Tạo khách mới

```txt
Module Phụ huynh-Tư vấn
→ + Thêm khách mới
→ nhập parentName/phone/source/leadNeed
→ lưu parentConsultations[] local
→ customerStage = lead
→ consultationStatus = newLead
```

### 8.2. Gán tư vấn phụ trách

```txt
lead
→ chọn consultantName/consultantId
→ thêm care log đầu tiên
→ customerStage có thể chuyển consulting
→ consultationStatus = waitingResponse hoặc trialScheduled
```

F23.3B có thể dùng `consultantName` text nếu chưa có danh sách staff/consultant chuẩn.

### 8.3. Đặt lịch tư vấn/học thử

```txt
consulting
→ thêm appointment
→ appointmentType = consultation hoặc trialLesson
→ consultationStatus = trialScheduled nếu là học thử
→ nextAction cập nhật theo lịch hẹn
```

Không tạo attendance, không tạo học phí.

### 8.4. Chuyển thành phụ huynh

```txt
consulting
→ mở convert preview
→ kiểm tra phone trùng với student/parent/contact
→ người dùng chọn tạo mới hoặc ghép
→ customerStage = converted khi phase convert thật được bật
```

F23.3B chỉ nên làm preview/readiness, chưa ghi parent/student thật.

### 8.5. Tạo học viên từ khách/phụ huynh

Phase sau F23.3D/F23.3E:

```txt
converted contact
→ tạo student draft từ enrollmentDraft
→ set primaryParentId/parentIds
→ set initialConsultantId
→ linkedStudentIds cập nhật trên contact
→ giữ parentName/phone legacy để UI hiện tại không vỡ
```

Không tạo gói học phí tự động.

### 8.6. Liên kết với Học phí

Học phí chỉ đọc sau khi có `studentId`.

```txt
studentId
→ tuitionRecords tìm theo studentId
→ đọc parent chuẩn nếu có
→ fallback parentName/parentPhone legacy
```

Không update `tuition.usedSessions`, không attendance-to-tuition.

## 9. Quyền và role tư vấn

Thiết kế dài hạn:

- `owner`, `qtv`, `center_admin`: xem toàn bộ CRM;
- `consultant`: xem khách mình phụ trách;
- `viewer`: chỉ đọc nếu được cấp;
- giáo viên không mặc định là tư vấn.

F23.3B local-safe chưa implement Auth/permission thật. Nếu cần hiển thị tư vấn phụ trách ngay, dùng text `consultantName` hoặc danh sách staff local hiện có. `consultantId` thật cần phase liên quan C7 quyền.

## 10. F23.3B MVP local-safe đề xuất

Tên phase:

```txt
F23.3B - CRM shell Phụ huynh-Tư vấn local-safe
```

Nên làm:

1. Reuse Module Phụ huynh/Tư vấn hiện có.
2. Thêm derive/display `customerStage` 3 loại, không migration phá dữ liệu.
3. Thêm filter 3 stage:
   - `Khách mới`;
   - `Đang tư vấn`;
   - `Đã chuyển đổi`.
4. Danh sách khách hàng/phụ huynh hiển thị stage, tư vấn phụ trách fallback, nhu cầu, next action, linked students.
5. Form thêm khách mới local-safe:
   - parentName/phone/source;
   - leadStudentName/age;
   - leadNeed;
   - consultantName;
   - first note optional.
6. Detail khách read-only/edit nhẹ.
7. Ghi chú chăm sóc local-safe vào `contact.careLogs`.
8. Convert CTA ở trạng thái disabled/preview nếu chưa làm F23.3D.
9. Không sửa Học phí/Học viên sâu.
10. Không Auth/Supabase/SQL/cloud.

Definition of Done F23.3B:

- có thể lọc đúng 3 stage;
- tạo lead local-safe không ảnh hưởng học viên/học phí;
- thêm care log không ghi sang `student.careNotes` khi chưa linked;
- existing parentConsultations cũ vẫn render được;
- derived contacts từ students vẫn fallback tốt;
- build/test/mojibake pass.

## 11. Defer rõ ràng

Chưa làm trong F23.3B:

- dedupe phụ huynh tự động bằng số điện thoại;
- tạo parent entity chuẩn;
- convert thật tạo học viên;
- tạo/gán học phí;
- phân quyền tư vấn thật;
- Supabase/cloud sync;
- import Excel khách hàng;
- báo cáo chỉ số tư vấn;
- Zalo/email/SMS;
- lưu file khách hàng;
- retention 3-5 năm;
- production audit trail;
- Teacher Workspace.

## 12. Rủi ro và cách giảm

1. Phụ huynh đang nằm rải trong nhiều học viên.
   - Giảm rủi ro bằng derived contacts và gợi ý dedupe, không auto merge.
2. Một phụ huynh có nhiều học viên.
   - Dùng `linkedStudentIds`, không chỉ `studentId` đơn.
3. Một học viên có nhiều người liên hệ.
   - Chuẩn bị `parentIds`, nhưng MVP giữ `primaryParentId` đơn giản.
4. Phone không phải khóa định danh tuyệt đối.
   - Dedupe theo phone chỉ là warning/preview.
5. Convert sớm dễ tạo học viên/học phí rác.
   - F23.3B chỉ làm shell/preview, convert thật để F23.3D.
6. Ghi chú bị trùng giữa CRM và Học viên.
   - CRM note trước convert giữ ở `contact.careLogs`; chỉ hợp nhất read-only khi linked.
7. Consultant role chưa chốt quyền.
   - Dùng `consultantName` local trước, `consultantId` thật để phase C7/F23 sau.

## 13. Open questions trước khi code

- `customerStage` có chốt tên field này không?
- F23.3B có cần thêm `consultantName` vào form ngay không?
- Danh sách tư vấn lấy từ staff, membership hay nhập text?
- Convert preview cần hiện dedupe theo phone ngay ở F23.3B hay để F23.3D?
- Note CRM có cần tag/chủ đề trong MVP hay chỉ content/result/nextAction như careLogs hiện tại?
- Converted contact có nên tính derived từ `studentId` trước khi có `linkedStudentIds` không?

## 14. Guard implementation

Khi code các phase sau:

- không sửa công thức Học phí;
- không update `tuition.usedSessions`;
- không attendance-to-tuition;
- không tự tạo học phí khi convert;
- không sửa Teacher Workspace;
- không Auth/Supabase/SQL/deploy nếu chưa được duyệt;
- không xóa field legacy `parentName/parentPhone` trên student trong MVP.
