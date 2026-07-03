# C8.0 - Thiết kế Teacher Portal, hồ sơ giáo viên và roadmap C8

## 1. Trạng thái

```txt
C8.0 STATUS: TEACHER PORTAL PROFILE ROADMAP DESIGN
C7_9_STATUS: ACCOUNT_LIFECYCLE_READY_FOR_TEACHER
TEACHER_IS_REAL_PERSON: YES
TEACHER_USES_REAL_EMAIL: YES
TEACHER_PUBLIC_SIGNUP_ALLOWED: NO
TEACHER_DIFFERS_FROM_CENTER_ADMIN: YES
CENTER_ADMIN_EMAIL_PATTERN_PRESERVED: YES
TEACHER_PROFILE_DESIGNED: YES
MY_SCHEDULE_DESIGNED: YES
MY_SESSION_DETAIL_DESIGNED: YES
CHECKIN_DESIGNED: YES
CHECKOUT_DESIGNED: YES
CHECKIN_ONE_IMAGE_ONLY: YES
CHECKOUT_MULTIPLE_IMAGES_ALLOWED: YES
GPS_REQUIRED: NO
MEDIA_STORAGE_RISK_NOTED: YES
ATTENDANCE_STAYS_IN_SESSION_TKB_FLOW: YES
CLASS_REPORT_STAYS_IN_SESSION_TKB_FLOW: YES
STUDENT_DETAIL_FOR_TEACHER_DESIGNED: YES
STUDENT_CREATE_BY_TEACHER_ALLOWED: NO
STUDENT_TEST_HANDOFF_DESIGNED: YES
PROGRESS_REPORT_DESIGNED: YES
C8_ROADMAP_SHORT_INCLUDED: YES
C8_ROADMAP_DETAILED_INCLUDED: YES
RUNTIME_CHANGED: NO
SQL_CREATED: NO
DEPLOY_BY_CODEX: NO
COMMIT: NOT RUN
PUSH: NOT RUN
```

C8.0 chỉ là design pack. Không sửa runtime, không tạo SQL, không deploy, không tạo account thật, không chuyển code TKB trong phase này.

## 2. Hiện trạng source liên quan

Inspect trước khi viết docs cho thấy:

- Module TKB hiện đã có dữ liệu ca dạy với `teacherId`, `teacherName`, `studentIds`, lịch recurring/one-off, chi tiết ca và luồng lưu `sessionReports`.
- Điểm danh và báo cáo ca dạy hiện nằm trong TKB/session: `schedule-module`, `attendance-records`, `cloud-session-reports` và `cloud-attendance-realtime` đang dùng `sessionReports` và canonical attendance/read-model.
- Module Học viên đã có hồ sơ học viên, giáo viên phụ trách qua `assignedTeacherId`, màn hình chi tiết học viên và các liên kết học phí/phụ huynh ở admin side.
- Module Giáo viên đã có dữ liệu/hồ sơ giáo viên phía admin side qua `teacher-module`, `teacher-data`, cloud entity `teacher`.
- Teacher Portal chưa tách riêng. Teacher account/role chưa hoàn thiện thành portal riêng; C7.9 mới chốt account lifecycle, access denied và nền owner/admin trước khi mở mảng teacher.

Kết luận: C8 nên tái sử dụng luồng TKB/session hiện có, nhưng đổi "nhà" thao tác cho giáo viên. Không di chuyển toàn bộ TKB vội.

## 3. Teacher là ai và khác admin thế nào?

Nguyên tắc ngắn:

`Teacher không quản lý cơ sở. Teacher thực hiện ca dạy và báo cáo.`

Teacher khác admin vì teacher là một người thật thực hiện ca dạy, còn admin cơ sở là tài khoản vận hành cơ sở.

Admin cơ sở:

- Là tài khoản vận hành cơ sở.
- Dùng email nội bộ theo pattern `admin.*`, ví dụ `admin.dreamhome@ichess.vn`.
- Quản lý học viên, lịch, dữ liệu cơ sở, tài khoản cơ sở và các thao tác vận hành.
- Không đại diện cho một con người giáo viên cụ thể.

Teacher:

- Là con người thật.
- Dùng Gmail thật hoặc email thật, ví dụ `ducthang.ichess@gmail.com`.
- Có hồ sơ cá nhân/nghề nghiệp riêng.
- Chỉ thấy việc liên quan đến mình.
- Không quản lý cơ sở, không thấy học phí, account management, Internal Center Console.
- Thực hiện ca dạy, điểm danh, báo cáo, check-in/check-out.

## 4. Teacher account/email

Hướng C8:

- Teacher dùng Gmail thật/email thật.
- Không mở public signup tự do.
- Owner/admin được cấp quyền sẽ tạo hoặc mời teacher bằng email thật.
- Nếu teacher đăng nhập nhưng chưa được gắn cơ sở hoặc chưa có lịch dạy, app hiển thị pending access/access denied rõ ràng.
- Một teacher có thể thuộc nhiều cơ sở, nhưng quyền xem/sửa phải theo cơ sở và ca dạy được phân công.
- Không dùng email dạng `admin.*` cho teacher.

Open design cho C8.1: chốt teacher access map qua `center_members.role = teacher`, bảng assignment riêng, hoặc hybrid. C8.0 chưa tạo bảng.

## 5. Hồ sơ giáo viên

C8 nên bắt đầu bằng hồ sơ giáo viên vì đây là nền cho account, lịch dạy, phân ca và báo cáo.

### 5.1. Thông tin cá nhân

- Họ và tên.
- Email đăng nhập/Gmail thật.
- Số điện thoại.
- Năm sinh hoặc ngày sinh.
- Giới tính nếu cần.
- Quê quán.
- Địa chỉ hiện tại nếu cần.
- Ảnh đại diện nếu sau này có storage phù hợp.

### 5.2. Thông tin nghề nghiệp

- Trạng thái: đang dạy, tạm nghỉ, ngừng dạy.
- Loại giáo viên: full-time, part-time, cộng tác viên.
- Cơ sở đang phụ trách.
- Nội dung dạy: cờ vua cơ bản, nâng cao, đội tuyển, bot/chess engine nếu có.
- Cấp độ phù hợp: Dolphin, Monkey, các level nội bộ khác.
- Điểm mạnh/chuyên môn.
- Ghi chú nội bộ.

### 5.3. Lịch/availability

- Ngày có thể dạy.
- Khung giờ có thể dạy.
- Số ca tối đa/tuần.
- Có nhận học viên mới hay không.
- Ưu tiên cơ sở nào.

### 5.4. Thông tin vận hành

- Check-in/check-out compliance sau này.
- Số ca chưa báo cáo.
- Số ca dạy trong tháng.
- Ghi chú admin/owner.
- Lịch sử thay đổi trạng thái nếu cần audit về sau.

## 6. Teacher Portal MVP

### 6.1. Lịch dạy của tôi

Teacher login sẽ thấy "Lịch dạy của tôi", không thấy toàn bộ TKB của cơ sở như admin.

Màn hình cần có:

- Ca dạy hôm nay.
- Ca sắp tới.
- Ca đã dạy nhưng chưa báo cáo.
- Cơ sở/địa điểm.
- Tên lớp/ca.
- Giờ học.
- Danh sách học viên.
- Trạng thái check-in/check-out/báo cáo.

### 6.2. My session detail

Khi giáo viên bấm vào ca dạy của mình:

- Nếu ca chưa dạy: thấy thông tin ca, học viên, nút check-in nếu đã đến giờ.
- Nếu ca đang dạy hoặc đã dạy: vào màn hình report session.
- Không cần cổng hỏi "Bạn là Admin hay Giáo viên" trong Teacher Portal.
- Chức năng report hiện đang nằm ở TKB admin cần được chuyển/tái sử dụng đúng nhà.

Nguyên tắc:

`Trong Teacher Portal, bấm ca của tôi thì vào thẳng luồng giáo viên.`

## 7. Check-in

Yêu cầu nghiệp vụ:

- Check-in one image: chỉ cần upload 1 ảnh check-in.
- Không cần GPS.
- Không cần giáo viên tự ghi tên cơ sở như "Check-in Angel Wings".
- App biết ca ở cơ sở/địa điểm nào và tự hiển thị label.
- Ảnh có thể có timestamp từ camera, nhưng app vẫn lưu thời điểm upload/check-in để audit.
- Không nhập trạng thái thủ công.
- App tự tính trạng thái theo giờ.

Quy tắc thời gian:

- Cơ sở iChess chính: mốc check-in bắt đầu 30 phút trước ca dạy.
- Cơ sở liên kết/trường học: mốc check-in bắt đầu 15 phút trước ca dạy.
- Grace 5 phút.
- Ví dụ ca 18:00-19:30 tại cơ sở chính:
  - 17:30 đến 17:35: xanh.
  - 17:36 đến trước 18:00: vàng.
  - Từ 18:00 hoặc sau giờ bắt đầu ca: đỏ.

Tên status đề xuất:

- `Đúng giờ`: xanh, check-in trong grace.
- `Trong thời gian cho phép`: xanh, check-in trong cửa sổ hợp lệ trước giờ.
- `Trễ nhẹ`: vàng, sau grace nhưng trước giờ bắt đầu ca.
- `Trễ ca dạy`: đỏ, từ giờ bắt đầu ca trở đi.

App có thể cảnh báo ca chưa check-in trước giờ học.

## 8. Check-out

Yêu cầu nghiệp vụ:

- Upload ảnh là chính.
- Không cần GPS.
- App tự lưu timestamp.
- Không bắt buộc đúng 3 ảnh.
- Check-out multiple images: cho phép nhiều ảnh.
- Ảnh có thể gồm mặt giáo viên nếu có, phòng/lớp đã dọn, bảng điểm danh, ảnh khác liên quan.
- Có ghi chú nếu cần.
- Admin/owner xem lại được.

Check-out nên tách trạng thái với báo cáo ca: giáo viên có thể đã báo cáo nội dung nhưng còn thiếu ảnh check-out, hoặc ngược lại.

## 9. Media storage và nén ảnh

Đây là vấn đề lớn cần thiết kế trước khi code:

- Không lưu ảnh base64 trong localStorage.
- Không nhét ảnh vào `center_cloud_entities`.
- Dùng Supabase Storage hoặc storage chuyên ảnh.
- Client-side compress trước upload: JPEG/WebP, giới hạn width/height, giới hạn size.
- DB chỉ lưu metadata: `center_id`, `session_id`, `teacher_id`, `media_type`, `file_path`, `uploaded_at`, `captured_note`, `status`.
- Check-in chỉ 1 ảnh.
- Check-out nhiều ảnh.
- Cần retention policy vì mỗi tháng có thể phát sinh nhiều ảnh.

C8.0 không implement upload, không tạo bucket, không tạo policy.

## 10. Điểm danh và báo cáo trong TKB/session

Điểm danh trong TKB/session, không tách thành module riêng cho teacher ở C8.0.

Teacher mở ca dạy sẽ thấy danh sách học viên và chọn trạng thái:

- Có mặt.
- Vắng.
- Trễ.
- Học bù.
- Học thử.
- Ghi chú từng bé nếu cần.

Dữ liệu đi vào canonical attendance/session report theo hướng hiện có. Báo cáo trong TKB/session cũng giữ cùng luồng: teacher nhập nội dung buổi học, tình hình lớp, học viên nổi bật, học viên cần lưu ý, bài tập/nội dung về nhà, ghi chú cho admin/phụ huynh và mẫu copy kiểu Trello nếu cần.

## 11. Hồ sơ học viên cho giáo viên

Đây vẫn là Module Học viên, nhưng teacher mở ra là "Chi tiết học viên", không phải "Thêm học viên".

Teacher được:

- Xem học viên liên quan đến mình.
- Xem cấp độ học.
- Xem lịch sử điểm danh/học tập vừa đủ.
- Tạo ghi chú chuyên môn.
- Nhận xét.
- Cho điểm/đánh giá kỹ năng nếu cần.
- Đề xuất kế hoạch học tập.

Teacher không được:

- Sửa thông tin học phí.
- Sửa dữ liệu phụ huynh nhạy cảm nếu chưa cho phép.
- Tạo học viên chính thức trực tiếp.
- Xóa học viên.
- Xem toàn bộ học viên không liên quan.

## 12. Phiếu test bé/học thử

Teacher có thể test bé và gửi phiếu cho admin.

Form đề xuất:

- Tên bé.
- Tuổi/năm sinh.
- Phụ huynh/số điện thoại nếu có.
- Trình độ hiện tại.
- Kết quả test.
- Điểm mạnh.
- Điểm cần cải thiện.
- Đề xuất cấp độ/lớp.
- Ghi chú tính cách.
- Đề xuất học thử/chính thức.

Luồng:

- Teacher gửi phiếu test bé.
- Admin nhận và duyệt/nhập thành học viên.
- Teacher không tự tạo học viên chính thức.

## 13. Báo cáo học tập cuối kỳ

Cứ cuối kỳ/cuối khóa, teacher cần gửi nhận xét học tập.

Form đề xuất:

- Nhận xét tổng quan.
- Mức độ tập trung.
- Kỹ năng cờ vua.
- Tiến bộ.
- Điểm cần cải thiện.
- Đề xuất cấp độ tiếp theo.
- Ghi chú gửi phụ huynh.
- Kế hoạch học tập.

Không đưa báo cáo học tập cuối kỳ vào MVP đầu tiên nếu quá nặng, nhưng phải nằm trong roadmap C8.

## 14. Việc cần làm của giáo viên

Teacher Portal nên có task center:

- Ca hôm nay.
- Ca chưa check-in.
- Ca chưa check-out.
- Ca chưa nộp báo cáo.
- Học viên cần nhận xét cuối kỳ.
- Phiếu test bé chờ admin phản hồi.
- Cảnh báo bổ sung ảnh/check-out.

## 15. MVP đề xuất

MVP đầu tiên nên gồm:

1. Hồ sơ giáo viên.
2. Teacher account bằng Gmail thật nhưng do owner/admin mời/tạo.
3. Lịch dạy của tôi.
4. Mở ca dạy của tôi.
5. Điểm danh + báo cáo ca dạy.
6. Check-in/check-out ảnh bản nhẹ.
7. Hồ sơ học viên readonly + ghi chú/nhận xét.

Không đưa báo cáo học tập cuối kỳ vào MVP đầu tiên nếu chưa đủ nhẹ.

## 16. Roadmap rút gọn C8

- C8.0 - Teacher Portal scope, profile & roadmap design.
- C8.1 - Hồ sơ giáo viên + teacher account model.
- C8.2 - Teacher login shell + Lịch dạy của tôi.
- C8.3 - My session detail: chuyển báo cáo ca dạy từ TKB admin sang Teacher Portal.
- C8.4 - Check-in / Check-out + media storage plan.
- C8.5 - Điểm danh + báo cáo tình hình lớp trong ca dạy.
- C8.6 - Hồ sơ học viên cho giáo viên: xem chi tiết, ghi chú, nhận xét, cho điểm.
- C8.7 - Phiếu test bé / học thử gửi admin duyệt.
- C8.8 - Báo cáo học tập cuối kỳ.
- C8.9 - Teacher task center + checkpoint MVP.

## 17. Roadmap chi tiết C8

| Phase | Mục tiêu | Scope chính | Không làm | Kết quả mong muốn | Risk |
| --- | --- | --- | --- | --- | --- |
| C8.0 | Chốt thiết kế Teacher Portal | Hồ sơ, portal scope, check-in/out, student detail, roadmap | Runtime, SQL, deploy | Design pack đủ để code C8.1 | Scope quá rộng nếu biến thành implementation |
| C8.1 | Hồ sơ giáo viên + account model | Field profile, Gmail thật, owner/admin invite, multi-center rule | Public signup, teacher portal đầy đủ | Data/account model được chốt | Chưa rõ teacher dùng `center_members` hay assignment riêng |
| C8.2 | Teacher login shell + Lịch dạy của tôi | Shell portal, access denied/pending, danh sách ca của tôi | Không show toàn bộ TKB admin | Teacher vào được đúng không gian riêng | RLS/filter sai có thể lộ lịch cơ sở |
| C8.3 | My session detail | Mở ca của tôi, reuse report session từ TKB | Không di chuyển toàn bộ TKB vội | Teacher thao tác đúng ca được phân | Trùng logic admin/teacher nếu tách vội |
| C8.4 | Check-in/out + media plan | Một ảnh check-in, nhiều ảnh check-out, timestamp, status, storage design | Không upload ảnh nếu chưa có storage policy | Flow ảnh có thiết kế trước khi code | Dung lượng, retention, quyền xem ảnh |
| C8.5 | Điểm danh + báo cáo lớp | Attendance trong TKB/session, báo cáo tình hình lớp, Trello copy nếu cần | Không tạo module điểm danh riêng | Dữ liệu về canonical attendance/session report | Conflict nguồn admin/teacher |
| C8.6 | Hồ sơ học viên cho teacher | Xem chi tiết, ghi chú, nhận xét, đánh giá kỹ năng | Không sửa học phí, không xóa/tạo học viên | Teacher chăm sóc học viên liên quan | Dữ liệu phụ huynh nhạy cảm cần rule |
| C8.7 | Phiếu test bé/học thử | Form test, gửi admin duyệt, handoff thành học viên | Teacher không tự tạo học viên chính thức | Admin nhận lead/test có cấu trúc | Trùng với CRM/tư vấn nếu không chốt ownership |
| C8.8 | Báo cáo học tập cuối kỳ | Nhận xét tổng quan, kỹ năng, tiến bộ, kế hoạch | Không ép vào MVP đầu tiên | Có nền báo cáo phụ huynh | Form quá dài, teacher ngại nhập |
| C8.9 | Task center + checkpoint | Việc cần làm, cảnh báo thiếu report/ảnh, review MVP | Không mở thêm scope lớn | Teacher Portal MVP sẵn sàng checkpoint | Nhiều trạng thái cần định nghĩa chặt |

Nhấn mạnh:

- Không làm ảnh/upload storage ngay nếu chưa có design storage.
- Không mở signup tự do.
- Không cho teacher quyền admin.
- Không di chuyển toàn bộ TKB vội.
- Không phá admin TKB hiện tại.

## 18. Open questions

1. Teacher do owner tạo hay admin cơ sở được tạo?
2. Teacher có được thuộc nhiều cơ sở không?
3. Admin cơ sở có được xem check-in/check-out của teacher không?
4. Owner có xem tất cả cơ sở không?
5. Ảnh check-in/check-out giữ bao lâu?
6. Có cần nén ảnh về chuẩn nào?
7. Check-in ở cơ sở chính/liên kết phân loại dựa vào field nào?
8. Có bắt buộc check-out không?
9. Báo cáo Trello còn cần copy text ra ngoài không?
10. Teacher có thấy số điện thoại phụ huynh không?
11. Teacher có được tạo phiếu test bé không?
12. Teacher có được chấm điểm học viên theo thang nào?

## 19. Đề xuất C8.1

C8.1 nên bắt đầu với hồ sơ giáo viên + teacher account model. Chưa nên code upload ảnh, chưa mở Teacher Portal đầy đủ, và chưa chuyển toàn bộ TKB. Việc cần chốt đầu tiên là teacher là một người thật dùng Gmail thật, có hồ sơ global/center assignment rõ, và không bị lẫn với admin cơ sở.
