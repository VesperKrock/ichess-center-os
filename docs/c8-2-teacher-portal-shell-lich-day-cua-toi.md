# C8.2 - Teacher Portal shell và Lịch dạy của tôi

## 1. Trạng thái

```txt
C8.2 STATUS: TEACHER PORTAL SHELL MY SCHEDULE
C8_1_STATUS: TEACHER_PROFILE_ACCOUNT_MODEL_DONE
TEACHER_PORTAL_SHELL_ADDED: YES
TEACHER_LOGIN_REAL_AUTH_CREATED: NO
PUBLIC_SIGNUP_CREATED: NO
TEACHER_PORTAL_ENTRY_FROM_PROFILE: YES
MY_SCHEDULE_ADDED: YES
TEACHER_SCHEDULE_MATCH_BY_ID_OR_NAME: YES
MY_SESSION_DETAIL_PREVIEW_ADDED: YES
TKB_REPORT_LOGIC_MOVED: NO
ATTENDANCE_LOGIC_CHANGED: NO
CHECKIN_CHECKOUT_CREATED: NO
SQL_CREATED: NO
DEPLOY_BY_CODEX: NO
TEACHER_PROFILE_MODAL_HEIGHT_POLISHED: YES
TEACHER_PROFILE_HEADER_COMPACTED: YES
RUNTIME_CHANGED: YES
COMMIT: NOT RUN
PUSH: NOT RUN
```

C8.2 dựng "nhà giáo viên" ở mức shell/preview từ hồ sơ giáo viên. Chưa có teacher auth thật, chưa public signup, chưa Teacher Portal login thật, chưa chuyển TKB/report/attendance.

## 2. Mục tiêu

- Thêm entry point từ hồ sơ giáo viên để mở bản xem trước Teacher Portal.
- Hiển thị thông tin giáo viên, email đăng nhập tương lai, trạng thái dạy và trạng thái tài khoản.
- Hiển thị `Lịch dạy của tôi` từ dữ liệu TKB hiện có.
- Match ca dạy theo `teacherId`, fallback theo `teacherName` khi dữ liệu cũ chưa có id.
- Có detail preview cho từng ca dạy.
- Polish modal hồ sơ giáo viên: cao/responsive hơn, header gọn một hàng hơn.

## 3. Hiện trạng source

Sau C8.1, Module Giáo viên đã có hồ sơ giáo viên rõ hơn: email/Gmail thật, `loginEmail`, thông tin cá nhân, `accountStatus` và card tài khoản giáo viên ở mức readiness.

TKB/session hiện lưu giáo viên trên schedule bằng `teacherId`, `teacherName` và danh sách học viên bằng `studentIds`. Dữ liệu mới đi theo `teacherId`; dữ liệu cũ hoặc fallback có thể chỉ có `teacherName`.

Teacher Portal shell trong C8.2 chỉ đọc `scheduleSessions`, `students` và `sessionReports` để render preview. Không backfill, không ghi ngược vào TKB, không đổi `sessionReports`, không đổi report/attendance logic.

## 4. Entry point từ hồ sơ giáo viên

Trong hồ sơ giáo viên có entry `Mở Teacher Portal`. Đây là bản xem trước do admin mở từ hồ sơ giáo viên, không phải giáo viên đăng nhập thật.

Runtime copy:

`Đây là bản xem trước Teacher Portal. Tài khoản đăng nhập giáo viên sẽ được bật ở phase sau.`

Không có nút tạo account, không có signup, không có magic link/OTP.

## 5. Teacher Portal shell

Shell hiển thị:

- Tên giáo viên.
- Biệt danh/display name.
- Email đăng nhập tương lai.
- Trạng thái dạy.
- Trạng thái tài khoản.
- Summary cards: ca sắp tới, ca hôm nay, ca đã dạy, chưa báo cáo.

Shell nằm trong hồ sơ giáo viên để giữ scope preview/admin. C8.2 không mở login gate mới và không tạo route Teacher Portal thật.

## 6. Lịch dạy của tôi

`Lịch dạy của tôi` hiển thị các ca được gắn với giáo viên:

- Ngày.
- Giờ.
- Tên ca/lớp.
- Địa điểm/phòng.
- Số học viên.
- Trạng thái: `Sắp dạy`, `Hôm nay`, `Đã dạy`, `Chưa rõ`.

Nếu không có ca:

`Chưa có ca dạy nào được gắn với giáo viên này.`

## 7. Matching schedule by teacher

Logic C8.2:

1. Nếu session có `teacherId` và teacher profile có `id`, match `teacherId === teacher.id`.
2. Nếu không có `teacherId`, fallback normalize `teacherName` và so với `teacher.name`, `teacher.fullName`, `teacher.displayName`.
3. Không tự sửa schedule data.
4. Không backfill.
5. Không ghi ngược vào TKB.

Helper runtime gồm `getTeacherScheduleSessions`, `isScheduleSessionAssignedToTeacher`, `buildTeacherPortalSummary`.

## 8. My session detail preview

Mỗi card ca dạy có `Xem ca dạy`, mở detail preview tại chỗ:

- Tên ca.
- Thời gian.
- Địa điểm/phòng.
- Giáo viên.
- Danh sách học viên nếu có.
- Note: điểm danh và báo cáo ca dạy sẽ được chuyển vào Teacher Portal ở phase sau.

C8.3 mới xử lý My session detail thật. C8.4/C8.5 mới đi sâu check-in, report và attendance.

## 9. Polish hồ sơ giáo viên

Modal hồ sơ giáo viên:

- Tăng chiều cao responsive bằng `dvh`, không dùng height cố định cứng.
- Header gọn hơn: tên, biệt danh và badge nằm cùng một hàng khi đủ rộng.
- Body/pane vẫn scroll riêng.
- Buttons `Sửa`, `Ngừng dạy`, `Đóng` giữ ở bên phải và wrap trên màn hẹp.

Nội dung profile được giữ: thông tin cá nhân, card tài khoản giáo viên, giảng dạy, khả dụng, học viên liên quan.

## 10. Không làm trong C8.2

- Không tạo Auth user teacher.
- Không public signup.
- Không teacher login thật.
- Không đổi login gate.
- Không cấp role teacher thật.
- Không chuyển TKB/report session thật sang Teacher Portal.
- Không đổi điểm danh/Trello report hiện có.
- Không check-in/check-out.
- Không upload ảnh.
- Không Supabase Storage.
- Không SQL, không deploy, không Edge Function.

## 11. Manual QA checklist

1. Mở module `Giáo viên`.
2. Mở hồ sơ một giáo viên.
3. Expected: modal cao hơn, header gọn hơn, buttons vẫn dễ bấm.
4. Bấm `Mở Teacher Portal`.
5. Expected: thấy bản xem trước Teacher Portal, email đăng nhập tương lai và `Lịch dạy của tôi`.
6. Nếu giáo viên có ca: thấy danh sách ca.
7. Nếu không có ca: thấy empty state dễ hiểu.
8. Bấm `Xem ca dạy`.
9. Expected: thấy detail preview, không mở/đổi TKB admin.
10. Regression: thêm/sửa giáo viên, TKB, Học viên và form focus vẫn hoạt động.

## 12. Recommendation C8.3

C8.3 nên chuyển My session detail thật vào Teacher Portal: mở ca của tôi, reuse báo cáo ca dạy từ TKB admin theo boundary teacher, nhưng vẫn giữ admin TKB không bị phá.
