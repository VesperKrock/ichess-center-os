# Current UI audit

## Verified from repository

### Visual foundation hiện tại

- Dark UI: app background `#050607`, surface chính `#10151c`, surface mềm/titlebar `#151b24`.
- Text chính `#f4f7fb`, muted `#9fb1c7`, accent `#1f5d99`; border dùng alpha trắng/xanh.
- Font stack ưu tiên Inter rồi system UI; repo không tự tải Inter trong CSS được audit.
- Radius phổ biến khoảng 6–8 px ở shell/control; button shell tối thiểu 36 px cao.
- Desktop shortcut grid cố định 112 px; list mode 260–520 px.
- Window tối thiểu 420×320, titlebar 44 px, body có padding 22 px và scroll riêng.
- Focus-visible được khai báo ở nhiều shell/control; error, warning, success, disabled và badge có semantic style riêng.

### Information density

- Học viên và Thu chi có table 10 cột; Học phí 11 cột.
- Attendance là sheet theo học viên × ngày; schedule là grid 7 ngày.
- Nhiều module có stats + filter + table + form/detail overlay trong cùng window.
- Form Nhân viên, Giáo viên, CRM, Học viên và Hồ sơ hành chính có nhiều section/field.

Kết luận repo-level: đây là ứng dụng data-heavy; redesign cần density modes, sticky context và overflow rõ. Chưa thể kết luận density hiện tại “quá chật” nếu chưa xem screenshot và thao tác thật.

### Scrolling và window content

- Body bị khóa overflow; scroll xảy ra trong desktop/window/module/table/form.
- Nhiều table wrapper có horizontal overflow và table minimum width 620–1420 px.
- Schedule week grid minimum 1180 px; window body cũng có scroll.
- Hồ sơ hành chính dùng workspace với navigation và content scroll riêng; attachment viewer có overlay riêng.
- Known UX deferred: đóng attachment viewer đôi lúc làm vùng Hồ sơ hành chính nhảy scroll lên trên.

Kết luận repo-level: nested scrolling là rủi ro có thật về kiến trúc CSS/state, nhưng mức độ ảnh hưởng phải được review bằng screenshot/video.

### State coverage

Repo có nhiều empty, filtered-empty, validation, loading, error, warning, success, disabled, permission denied, backend unavailable, stale, archived và removed state. Design system phải hợp nhất visual grammar mà không xóa distinctions nghiệp vụ.

### Destructive actions

Runtime có confirmation cho archive/status changes, activity deletion/series deletion, soft removal và các action tài chính/lifecycle. Permanent deletion tệp nhân sự không được render. Thiết kế không được gom destructive action vào CTA primary chung.

### Vietnamese content

Label thực tế dài: tên module, reason, permission, lifecycle, warning và confirmation đều dùng tiếng Việt có dấu. Component không được thiết kế theo placeholder tiếng Anh ngắn.

## Needs screenshot review

1. Visual hierarchy giữa desktop background, shortcut, window và overlay.
2. Thứ tự ưu tiên button trong từng module, đặc biệt form nhiều action.
3. Table readability: truncation, sticky header/column, row height và scan path.
4. Nested scroll thực tế trên 1366×768 và 1440×900.
5. Window title/control hit area và state active/inactive nhìn thấy.
6. Taskbar overflow, center chip, notification và clock khi nhiều window.
7. Focus ring tương phản trên tất cả surface; keyboard order.
8. Contrast thực tế của muted text, border alpha và semantic badge.
9. Long form grouping, help text, error placement và footer action persistence.
10. Viewer ảnh/PDF, close/backdrop/Escape và scroll-return issue.
11. Compact laptop: schedule, attendance sheet, staff/admin profile, tuition/cashflow tables.
12. Browser zoom 125% và OS text scaling nếu thuộc môi trường dùng thật.

## Hypothesis for design exploration

Các mục dưới đây là giả thuyết, không phải kết luận audit:

- Một hierarchy surface rõ hơn có thể giảm cảm giác nhiều lớp tối giống nhau.
- Density toggle `Comfortable/Compact` cho table có thể phục vụ cả scan nhanh và nhập liệu.
- Sticky module header/filter/action bar có thể giảm mất context trong long scroll.
- Chuẩn hóa destructive action thành danger zone hoặc confirmation pattern chung có thể giảm lỗi.
- Dùng status icon + text, không chỉ màu, có thể cải thiện accessibility.
- Với schedule/attendance, frozen context và mini legend có thể quan trọng hơn việc thu nhỏ mọi thứ.
- Một token system thống nhất có thể thay hàng trăm màu alpha gần nhau mà vẫn giữ dark OS character.

Mỗi giả thuyết chỉ được đưa vào Gate A/B sau khi screenshot hoặc manual observation xác nhận vấn đề.
