# F23.11B.1 - Hotfix default filter Nhân viên và mojibake Chấm công

Ngày: 2026-07-27  
Phạm vi: filter/empty-state/deep-open của Nhân viên và UTF-8 tại display boundary Chấm công; không migration, không cloud write, không thay business data.

## 1. Kết quả và root cause direct-open

`initialStaffFilters.employmentStatus` và fallback của normalizer trước hotfix cùng dùng `active`. Filter chỉ là state trong bộ nhớ, không được persist và không thuộc `centerStaffMembers`; vì vậy Ctrl+F5 tạo state mới rồi ẩn record `GV001 · Nguyễn Trường Thịnh` đang có trạng thái `terminated`. Collection vẫn có một record và summary vẫn đúng, nhưng nhánh empty cũ chỉ nhìn filtered result nên báo nhầm là chưa có hồ sơ.

Contract F23.11B.1:

- fresh app/module bắt đầu với `Trạng thái: Tất cả trạng thái`;
- tìm kiếm rỗng, phòng ban/Giáo viên/tài khoản đều ở `Tất cả`;
- summary tiếp tục tính trên toàn bộ staff collection current center, còn header danh sách là filtered count;
- filter là presentation state trong phiên hiện tại, không ghi vào staff record hay local storage;
- không đổi `employmentStatus`, không kích hoạt lại staff và không đụng lifecycle history.

## 2. No-data và no-match

Hai empty state được tách rõ:

- collection thật sự rỗng: `Chưa có hồ sơ nhân viên.` và CTA `+ Thêm nhân viên`;
- collection có dữ liệu nhưng filtered count bằng 0: `Không có hồ sơ phù hợp với bộ lọc hiện tại.` và action `Xóa bộ lọc`.

`Xóa bộ lọc` chỉ tạo filter state mới: clear query, đưa department/status/teacher/account về `all`. Các filter riêng của disclosure Chấm công (`weekStartDate`, `location`, `person`) được giữ nguyên. Action không ghi storage và không sửa record.

## 3. Deep-open bằng stable staffMemberId

Action từ Giáo viên truyền stable staff ID đã lưu trong liên kết. Runtime refresh collection current center, yêu cầu đúng một record bằng `getUniqueCurrentCenterStaffMember(staffId)`, tạo edit state từ record đó rồi reset năm list filters. Không còn dựng search từ employee code/tên, và không tra bằng tên, email hay điện thoại.

Việc reset có chủ đích bảo đảm target terminated luôn hiện, không phụ thuộc filter cũ hay residual search. OS module vẫn dùng `openModuleWindowFromChildInteraction('nhan-vien')`, nên instance Nhân viên hiện có được focus thay vì tạo duplicate; taskbar/window contract không đổi. Trường hợp stable ID trùng hoặc không tồn tại fail closed với notice và không tự sửa dữ liệu.

## 4. Root cause mojibake Chấm công

Audit xác định chuỗi hỏng không đến từ phép tính chấm công:

1. `normalizeScheduleSessions()` trong `src/storage.js` có literal mặc định của `session.title` đã bị decode sai thay vì `Buổi học mẫu`.
2. Normalizer lịch có thể ghi kết quả normalize khi đọc, nên record thiếu title trước đây có khả năng đã nhận literal lỗi trong center-scoped schedule storage.
3. Disclosure `Chấm công theo lịch dạy hiện có` dựng derived rows từ `session.title/groupName`, `room`, teacher display name, session note và report note rồi escape/render trực tiếp; vì vậy legacy text lỗi đi thẳng ra UI.
4. Seed/runtime schedule data còn lại được kiểm tra và dùng Unicode sạch; không có bằng chứng cần migration toàn collection.

Literal nguồn đã được sửa thành UTF-8 `Buổi học mẫu`. Legacy value không bị auto-rewrite.

## 5. Safe repair boundary

`repairStaffAttendanceDisplayText()` chỉ được gọi khi tạo read-model của riêng disclosure Chấm công cho các trường hiển thị:

- tên ca/lớp/buổi học;
- địa điểm;
- teacher-derived display label;
- session/report note;
- person option và derived summary label liên quan.

Helper chỉ thử Windows-1252/single-byte → UTF-8 khi chuỗi có signature mojibake rõ. Kết quả phải không có replacement character và phải giảm số marker; tối đa hai pass. Chuỗi Unicode sạch được trả nguyên giá trị, kể cả text người dùng hoặc tên riêng không chứng minh được là mojibake.

Boundary này chỉ tạo display row mới. Nó không save schedule/session report, không rewrite local storage, không chạy migration và không đổi ID, teacher assignment, center, ngày, giờ, status, tổng buổi hay attendance calculation.

## 6. Focus, scroll và window

Filter danh sách refresh riêng panel `Hồ sơ nhân viên`; toolbar/search node không bị thay nên caret và select đang thao tác không mất vì full-app render. Filter Chấm công giữ nguyên `<details>` và các control, chỉ đồng bộ options rồi thay summary/table bên trong; trạng thái mở và outer scroll không bị reset. Không dùng pointer timeout, click giả hay `.focus()` workaround.

`Xóa bộ lọc` đồng bộ năm control hiện có trước khi refresh panel, nên click đầu tiên có hiệu lực. Child window Hồ sơ hành chính, taskbar, minimize/maximize/close và empty state F23.11B không bị thay đổi.

## 7. Bằng chứng manual trước hotfix và trạng thái QA

Manual QA F23.11B do người kiểm thử cung cấp đã PASS: action mở Hồ sơ hành chính, owner active, OS child window maximized riêng, taskbar, minimize/maximize/close, empty state `Chưa có Hồ sơ hành chính`, không tự tạo profile và không duplicate child window. Chưa tạo Hồ sơ hành chính; hotfix giữ nguyên empty state đó.

Manual QA F23.11B.1 vẫn đang chờ thực hiện. Automated smoke không được dùng để tự kết luận các luồng direct-open, dropdown first-click, caret, scroll, focus và taskbar là manual PASS.

Checklist Manual QA:

1. Ctrl+F5, mở trực tiếp Nhân viên: trạng thái là `Tất cả trạng thái`, GV001 xuất hiện.
2. Chọn `Đang làm việc`: thấy no-match, không thấy no-data; bấm `Xóa bộ lọc` một lần và GV001 trở lại.
3. Đặt filter khác, mở từ Giáo viên: đúng GV001 bằng stable staffMemberId, không duplicate module và taskbar/focus đúng.
4. Mở/đóng disclosure Chấm công và đổi filter: không jump scroll; tên ca/lớp/địa điểm/ghi chú là Unicode sạch.
5. Đối chiếu trước/sau: ngày, tổng buổi, teacher ID, schedule ID và attendance status không đổi.
6. Mở lại Hồ sơ hành chính: empty state đã manual PASS vẫn còn và không tự tạo profile.

## 8. Files và verification contract

Runtime sửa trong `src/staff-module.js`, `src/main.js`, `src/storage.js`. Docs F23.11B được nối ghi chú tương thích; smoke riêng nằm tại `tests/f23-11b-1-hotfix-default-filter-nhan-vien-va-mojibake-cham-cong-smoke.js`.

Verification gồm node syntax check, F23.11B.1/F23.11B, F23.10 regressions, direct/deep/filter/focus/scroll/window/taskbar/Teacher/TKB/attendance smokes, docs markers, public-secret scan, mojibake scan, build và `git diff --check`. Historical stale allowlist/wording failures nếu có phải được báo riêng, không sửa lan.

## 9. Roadmap

Sau khi người kiểm thử xác nhận F23.11B.1, tiếp tục manual Bước 2 của F23.11B: tạo Hồ sơ hành chính → validation → completion → masking/reveal. Hotfix không tự bắt đầu F23.11C.
