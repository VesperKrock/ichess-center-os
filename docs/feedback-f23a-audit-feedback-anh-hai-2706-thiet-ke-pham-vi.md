# F23A - Audit feedback anh Hải 27/06 và thiết kế phạm vi F23

F23A STATUS: DESIGN ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
RUNTIME CHANGE: NO
COMMIT: NOT RUN
PUSH: NOT RUN
DATA_MODEL_CHANGE: NO
LOCAL_STORAGE_KEY_CHANGE: NO
MERGE_THU_CHI_SO_QUY_LOGIC: NO
C6_STARTED: NO

## 1. Mục tiêu F23A

F23A audit feedback anh Hải ngày 27/06, phân loại rủi ro, khóa phạm vi F23B/C/D/E/F và ghi nguyên tắc an toàn trước khi mở các bước polish. Đây là pha audit/design trước C6, không sửa runtime, không tạo SQL, không chạy Supabase action, không commit và không push.

Mục tiêu quan trọng nhất là bảo vệ nền C5 realtime/cloud đã hoàn tất, đồng thời tách rõ feedback nhỏ có thể làm ngay khỏi các yêu cầu có rủi ro đổi logic sâu.

## 2. Trạng thái trước F23A

Workspace hiện tại sau checkpoint C5.3:

- Branch: `main`
- Latest commit: `c40feb2 C5.3 audit conflict rollback checkpoint`
- Worktree trước F23A: clean
- Repo đang ahead local so với `origin/main`
- C5.1, C5.2, C5.3 đã được checkpoint local

F23 là feedback/polish/workflow phase trước C6. F23 không phải C6 production và không được phá C5 realtime/cloud foundation.

## 3. Feedback gốc anh Hải 27/06

Nhóm tân trang giao diện / designer:

- Sau này sẽ có một đợt tân trang giao diện.
- Designer hoặc người chuyên thiết kế đồ họa sẽ hỗ trợ.
- App cần tạo các không gian để nạp dữ liệu hình ảnh, asset và theme về sau.
- Không đụng logic hoặc chức năng phần mềm.
- Deadline định hướng: 10/7.

Nhóm Báo cáo ngày:

- Đổi nhãn `THU - CHI` thành `Còn lại`.
- Bên trái thêm box `VIỆC CHƯA THỰC HIỆN`.
- Hộp công việc ngày có checklist tick được gồm: Điểm danh, TBHP, Nhắc thu HP, Chăm sóc phụ huynh định kỳ, Đưa đón bé, Trực nhật vệ sinh, Đăng bài đưa tin.
- Các công việc khác có thể nhập tay vào hộp nội dung.

Nhóm Thu chi / Sổ quỹ:

- Về bản chất Sổ quỹ và Thu chi nên nằm trong một nhóm để dễ nhìn.
- Sổ quỹ nên đặt trước Thu chi.
- Nhu cầu có dashboard theo ngày/tuần/quý/năm hoặc tùy chọn.
- Nhận định an toàn: gộp Thu chi và Sổ quỹ ở tầng logic là nguy hiểm, nên chỉ làm gọn ở tầng giao diện.

## 4. Phân loại feedback

Feedback có thể đi F23B:

- Đổi nhãn trong Báo cáo ngày từ `Thu - Chi` sang `Còn lại`.
- Thêm box `VIỆC CHƯA THỰC HIỆN`.
- Thêm checklist công việc ngày và ô nhập tay công việc khác.

Feedback có thể đi F23C:

- Tạo `Nhóm Tài chính` ở tầng navigation/workspace.
- Đặt Sổ quỹ trước Thu chi.
- Bố trí tab/section để dễ quan sát, không nhét hai module đầy đủ vào một màn hình dài.

Feedback có thể đi F23D:

- Chuẩn bị UI readiness cho designer: image slots, theme hooks, logo/banner/module icon slots, CSS variables/class wrappers nếu an toàn.
- Không thêm asset thật khi chưa có nguồn.

Feedback cần giữ cho phase sau hoặc cần duyệt riêng:

- Merge logic Thu chi/Sổ quỹ.
- Đổi data model hoặc localStorage key.
- Dashboard tài chính quý/năm nếu chưa có aggregation chuẩn.
- Bất kỳ cloud sync/realtime hoặc Supabase change nào.

## 5. Nhận định rủi ro

Risk matrix:

| Mức | Hạng mục | Nhận định |
| --- | --- | --- |
| Thấp | Đổi label `Thu - Chi` -> `Còn lại` | Chỉ đổi text hiển thị trong Báo cáo ngày nếu xác định đúng hook. |
| Thấp | Docs/checklist local-only | An toàn nếu không nối sang finance/session/attendance/tuition/cloud. |
| Trung bình | Checklist persistence theo ngày | Cần key riêng, scoped center/date, không tái dùng storage nghiệp vụ khác. |
| Trung bình | UI readiness slots | Có thể ảnh hưởng layout nếu đặt slot quá lớn hoặc thiếu responsive constraints. |
| Cao | Merge Thu chi/Sổ quỹ logic/storage | Dễ làm sai công thức, reconciliation, localStorage và cloud foundation. |
| Cao | Dashboard tài chính quý/năm | Không được bịa logic nếu aggregation chuẩn chưa có. |

## 6. Nguyên tắc an toàn F23

- F23 chỉ xử lý feedback/polish/workflow trước C6.
- Không mở C6 trong F23A/B/C/D/E/F trừ khi user chủ động đổi roadmap.
- Không SQL, không Supabase action, không cloud/realtime change.
- Không đổi data model, không đổi localStorage key hiện có.
- Không merge logic Thu chi/Sổ quỹ.
- Không tự nối attendance sang học phí.
- Không sửa công thức Thu chi, Sổ quỹ, Báo cáo nếu không có phase riêng.
- Không xóa module cũ.
- Không import UI library mới.

## 7. F23B scope — Báo cáo ngày

F23B chỉ sửa module Báo cáo ngày.

Scope đề xuất:

- Đổi label `Thu - Chi` thành `Còn lại`.
- Thêm box `VIỆC CHƯA THỰC HIỆN` ở khu vực bên trái theo feedback.
- Thêm checklist tick được cho công việc ngày.
- Checklist mặc định gồm: Điểm danh, TBHP, Nhắc thu HP, Chăm sóc phụ huynh định kỳ, Đưa đón bé, Trực nhật vệ sinh, Đăng bài đưa tin.
- Thêm ô nhập tay cho công việc khác.

Nguyên tắc dữ liệu F23B:

- Nếu cần persist checklist, dùng key localStorage riêng, scoped theo center/date.
- Key đề xuất: `ichessCenterOS.dailyReportTasks.<centerId>`.
- Không đụng dữ liệu tài chính.
- Không đụng session_report, attendance, tuition.
- Không cloud sync trong F23B trừ khi có phase thiết kế riêng.

## 8. F23C scope — Nhóm Tài chính

F23C chỉ là wrapper UI nhóm Tài chính, không merge logic Thu chi/Sổ quỹ.

Tên đề xuất: `Nhóm Tài chính`.

Scope an toàn:

- Tạo workspace/wrapper UI cho nhóm Tài chính.
- Đặt Sổ quỹ trước Thu chi theo feedback anh Hải.
- Dùng tab hoặc section: Tổng quan, Sổ quỹ, Thu chi, Đối soát.
- Giữ Thu chi và Sổ quỹ vẫn có thể mở riêng nếu app hiện đang có module riêng.
- Tránh nhét toàn bộ hai module vào một màn hình dài.
- Ưu tiên summary card, tab, collapse hoặc navigation nhẹ.

Không làm trong F23C:

- Không merge logic.
- Không merge storage.
- Không đổi công thức.
- Không xóa module Thu chi.
- Không xóa module Sổ quỹ.
- Không đổi localStorage key.
- Không đổi cloud/storage foundation.
- Không tạo dashboard quý/năm bằng logic giả. Nếu dữ liệu aggregation chưa sẵn sàng, ghi accepted limitation.

## 9. F23D scope — UI readiness cho designer

F23D chuẩn bị không gian để designer nạp hình ảnh/theme về sau, không đổi logic và không đổi chức năng.

Scope đề xuất:

- Slot logo trung tâm/cơ sở.
- Slot banner hoặc module hero nếu an toàn với layout.
- Slot icon module nếu cần.
- Theme hooks bằng class names ổn định.
- CSS variables hoặc class wrapper nếu phù hợp.
- Placeholder text tiếng Việt có dấu.
- Không hardcode ảnh thật nếu chưa có asset chính thức.

Không làm trong F23D:

- Không redesign toàn app.
- Không đổi layout lớn.
- Không đổi business logic.
- Không đổi data flow.
- Không import thư viện UI mới.
- Không thêm asset thật nếu chưa được cung cấp.

## 10. Những gì F23 không làm

- Không mở C6 production.
- Không tạo hoặc chạy SQL.
- Không Supabase action.
- Không cloud sync/realtime change.
- Không đổi data model.
- Không đổi localStorage key hiện có.
- Không merge logic Thu chi/Sổ quỹ.
- Không đổi công thức tài chính.
- Không xóa module hiện có.
- Không refactor lớn.
- Không reset localStorage hoặc seed đè dữ liệu.
- Không commit/push nếu user chưa yêu cầu.

## 11. Không merge logic Thu chi/Sổ quỹ

F23C chỉ gộp ở tầng giao diện/navigation. Thu chi và Sổ quỹ tiếp tục giữ logic, storage, công thức và trách nhiệm hiện tại.

Mọi yêu cầu merge logic/storage phải tách phase riêng, có thiết kế migration, manual QA và user duyệt trước khi implement.

## 12. Không đổi data model/localStorage

F23A không đổi data model và không đổi localStorage key.

F23B nếu cần lưu checklist chỉ được dùng key mới riêng cho checklist Báo cáo ngày: `ichessCenterOS.dailyReportTasks.<centerId>`. Key này không thay thế, không migrate và không ghi đè các key tài chính/session/attendance/tuition hiện có.

F23C không đổi key Thu chi, Sổ quỹ hoặc bất kỳ key cloud/cache nào.

## 13. Không SQL/Supabase/cloud/realtime

F23A/B/C/D/E/F không tạo SQL, không chạy SQL, không Supabase action và không đổi cloud/realtime.

Các phần C5 realtime/cloud đã checkpoint phải được xem là nền ổn định. F23 chỉ làm UI/workflow local trong phạm vi được khóa.

## 14. Manual QA plan cho F23B

- Mở Báo cáo ngày ở center hiện tại.
- Xác nhận label `Thu - Chi` đã thành `Còn lại`.
- Xác nhận box `VIỆC CHƯA THỰC HIỆN` hiển thị đúng vị trí, không che nội dung cũ.
- Tick/untick các mục: Điểm danh, TBHP, Nhắc thu HP, Chăm sóc phụ huynh định kỳ, Đưa đón bé, Trực nhật vệ sinh, Đăng bài đưa tin.
- Nhập công việc khác bằng text tự do.
- Nếu có persist, đổi ngày rồi quay lại để kiểm tra dữ liệu scoped theo ngày.
- Kiểm tra không có thay đổi trong Thu chi, Sổ quỹ, Học phí, Điểm danh, realtime/cloud.

## 15. Manual QA plan cho F23C

- Mở `Nhóm Tài chính`.
- Xác nhận Sổ quỹ đặt trước Thu chi.
- Xác nhận tab/section gồm: Tổng quan, Sổ quỹ, Thu chi, Đối soát.
- Xác nhận Thu chi và Sổ quỹ giữ behavior cũ.
- Thêm/xem giao dịch hiện có theo flow cũ nếu F23C runtime sau này cho phép.
- Kiểm tra localStorage key không đổi.
- Kiểm tra không có merge logic, không xóa module, không sửa công thức.
- Với dashboard quý/năm: nếu chưa có aggregation chuẩn, xác nhận UI ghi limitation thay vì hiển thị số giả.

## 16. Manual QA plan cho F23D

- Mở các màn hình có logo/banner/icon/theme hooks.
- Xác nhận placeholder hoặc slot không làm vỡ layout desktop/mobile.
- Xác nhận không có asset thật được thêm khi chưa cung cấp.
- Xác nhận theme hooks/class wrappers không đổi logic click/input/save.
- Kiểm tra các module chính vẫn mở được.
- Kiểm tra không có thay đổi business logic, data flow, cloud/realtime.

## 17. Risks / blockers

Hiện không có blocker để hoàn tất F23A vì worktree trước F23A clean và phạm vi chỉ docs/test.

Rủi ro cần giữ khi sang F23B/C/D:

- F23B có thể thành medium risk nếu persist checklist theo ngày không scoped đúng.
- F23C sẽ thành high risk nếu ai đó biến wrapper UI thành merge logic/storage.
- F23D có thể ảnh hưởng layout nếu slot hình ảnh thiếu giới hạn kích thước.
- Dashboard tài chính tuần/quý/năm cần nguồn aggregation chuẩn; nếu chưa có thì chỉ ghi limitation.

## 18. Open questions

- F23B checklist có cần persist ngay hay chỉ local UI trong session?
- F23B box `VIỆC CHƯA THỰC HIỆN` nằm chính xác ở panel nào của Báo cáo ngày?
- F23C `Nhóm Tài chính` nên là module mới trong dashboard hay wrapper trong nhóm module hiện có?
- F23D designer sẽ cung cấp asset format nào: logo, banner, icon set, palette hay design tokens?
- Deadline 10/7 áp dụng cho F23D readiness hay cả vòng polish F23?

## 19. Roadmap sau F23

F23 — Feedback anh Hải 27/06:

- F23A — Audit feedback và thiết kế phạm vi
- F23B — Báo cáo ngày: đổi `Còn lại` + checklist việc chưa thực hiện
- F23C — Nhóm Tài chính: wrapper UI cho Sổ quỹ + Thu chi, không merge logic
- F23D — UI readiness cho designer: image slots/theme hooks, không đổi logic
- F23E — Checkpoint review
- F23F — Commit local feedback checkpoint

C6 — Production + expansion:

- C6.1 — DreamHome production empty center
- C6.2 — Multi-center toàn quốc
- C6.3 — Teacher portal architecture
- C6.4 — Teacher portal MVP
- C6.5 — Super Admin / phân quyền / tài khoản

## 20. Recommendation

Nếu F23A PASS: GO for F23B — Báo cáo ngày: đổi `Còn lại` + checklist việc chưa thực hiện.

Không mở C6 cho đến khi F23 checkpoint xong hoặc user chủ động bỏ qua F23.
