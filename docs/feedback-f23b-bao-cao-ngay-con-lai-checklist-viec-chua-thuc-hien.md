# F23B - Báo cáo ngày: Còn lại + checklist việc chưa thực hiện

F23B STATUS: REPORT MODULE ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
CLOUD_SYNC: NO
RUNTIME CHANGE: YES, REPORT UI ONLY
COMMIT: NOT RUN
PUSH: NOT RUN
FINANCE_LOGIC_CHANGE: NO
MERGE_THU_CHI_SO_QUY_LOGIC: NO
C6_STARTED: NO

## 1. Mục tiêu F23B

F23B xử lý feedback anh Hải ngày 27/06 trong phạm vi module Báo cáo: đổi nhãn báo cáo từ `Thu - Chi`/chênh lệch sang `Còn lại`, thêm box `VIỆC CHƯA THỰC HIỆN`, thêm checklist tick được và thêm ô nhập tay cho công việc khác.

F23B không phải F23C, không nhóm Tài chính, không gộp Thu chi/Sổ quỹ, không SQL, không Supabase, không cloud sync và không commit/push.

Nguyên tắc scope: F23B không đụng Thu chi/Sổ quỹ và không đổi logic tài chính.

## 2. Trạng thái trước F23B

- Latest commit: `c40feb2 C5.3 audit conflict rollback checkpoint`
- Ahead/behind expected: `main...origin/main [ahead 4]`
- Worktree trước F23B: chỉ có 2 file F23A expected, untracked.
- F23A: PASS, chưa commit.

## 3. Feedback anh Hải liên quan F23B

Feedback cần xử lý:

- `THU - CHI` chỉnh thành `Còn lại`.
- Bên trái thêm hộp ghi chú `VIỆC CHƯA THỰC HIỆN`.
- Hộp công việc ngày thêm checklist tick được.
- Checklist gồm: Điểm danh, TBHP, Nhắc thu HP, Chăm sóc phụ huynh định kỳ, Đưa đón bé, Trực nhật vệ sinh, Đăng bài đưa tin.
- Công việc khác có thể nhập tay.

## 4. Files đã sửa

Runtime Báo cáo:

- `src/report-module.js`
- `src/main.js`

Style Báo cáo:

- `src/styles.css`

Docs/test:

- `docs/feedback-f23b-bao-cao-ngay-con-lai-checklist-viec-chua-thuc-hien.md`
- `tests/feedback-f23b-bao-cao-ngay-con-lai-checklist-viec-chua-thuc-hien-smoke.js`

Không sửa Thu chi, Sổ quỹ, cloud files, SQL files, package files hoặc C6 files.

## 5. Label “Còn lại”

Trong module Báo cáo, các nhãn hiển thị tổng hợp số còn lại/chênh lệch được đổi sang `Còn lại`.

Phạm vi đổi chỉ là label hiển thị trong Báo cáo. Công thức vẫn là thu trừ chi, không đổi ý nghĩa số liệu, không đổi nguồn dữ liệu và không đổi dashboard tài chính.

## 6. Box “VIỆC CHƯA THỰC HIỆN”

Báo cáo ngày có box `VIỆC CHƯA THỰC HIỆN` trong form nội dung ngày. Box nằm cùng nhóm nhập liệu Báo cáo ngày, gần `Công việc ngày`, `Tình huống/vấn đề`, `Ghi chú vận hành` và `Người phụ trách`.

Box dùng layout compact để không đẩy vỡ Báo cáo tuần/chart.

## 7. Checklist mặc định

Checklist mặc định gồm:

- Điểm danh
- TBHP
- Nhắc thu HP
- Chăm sóc phụ huynh định kỳ
- Đưa đón bé
- Trực nhật vệ sinh
- Đăng bài đưa tin

Mỗi mục có checkbox tick/untick được. Tick/untick chỉ cập nhật `reportState.draft.pendingTasks` trong runtime state của module Báo cáo.

## 8. Công việc khác nhập tay

Box `VIỆC CHƯA THỰC HIỆN` có ô nhập tay `Công việc khác` dùng field `otherPendingTasks`. Field này đi theo report draft và được đưa vào nội dung tải/in báo cáo.

## 9. Persistence local-only nếu có

F23B hiện không tạo localStorage key mới và không persist checklist qua reload. Lý do: module Báo cáo hiện chỉ giữ draft trong runtime state, chưa có cơ chế lưu riêng ổn định cho Báo cáo ngày.

Accepted limitation:

- Tick checklist và `Công việc khác` giữ trong runtime state khi đang mở app.
- Reload app sẽ mất draft checklist, giống giới hạn hiện tại của draft Báo cáo ngày.
- Không dùng key `ichessCenterOS.dailyReportTasks.<centerId>` trong F23B để tránh mở thêm storage surface khi chưa có QA riêng.

## 10. Những gì F23B không làm

- Không sửa Thu chi.
- Không sửa Sổ quỹ.
- Không làm F23C.
- Không gộp Thu chi/Sổ quỹ.
- Không đổi công thức doanh thu/chi phí/còn lại.
- Không đổi dữ liệu tài chính.
- Không đổi localStorage key hiện có.
- Không tạo localStorage key mới.
- Không SQL.
- Không Supabase action.
- Không cloud sync.
- Không realtime mới.
- Không mở C6.
- Không commit/push.

## 11. Không đụng Thu chi/Sổ quỹ

F23B chỉ sửa module Báo cáo và style liên quan. Thu chi và Sổ quỹ không bị sửa runtime, không bị gộp, không bị đổi navigation và không bị đổi storage.

F23C mới là phase wrapper UI `Nhóm Tài chính`, nhưng F23B không làm F23C.

## 12. Không đổi logic tài chính

F23B chỉ đổi nhãn hiển thị `Còn lại`. Công thức vẫn đọc dữ liệu cashflow hiện có và tính theo thu trừ chi như trước.

Không đổi transaction, category, cashbook reconciliation, storage tài chính hoặc cloud foundation.

## 13. Không SQL/Supabase/cloud/realtime

F23B không tạo SQL, không chạy SQL, không gọi Supabase, không thêm cloud sync cho checklist và không thêm realtime.

Checklist là UI/runtime state trong module Báo cáo.

## 14. Manual QA plan

1. Mở app local.
2. Mở module Báo cáo.
3. Kiểm tra label `Thu - Chi`/chênh lệch hiển thị trong Báo cáo đã thành `Còn lại`.
4. Kiểm tra phần Báo cáo ngày có box `VIỆC CHƯA THỰC HIỆN`.
5. Tick/untick từng mục: Điểm danh, TBHP, Nhắc thu HP, Chăm sóc phụ huynh định kỳ, Đưa đón bé, Trực nhật vệ sinh, Đăng bài đưa tin.
6. Nhập nội dung ở `Công việc khác`.
7. Tải/In báo cáo và kiểm tra checklist, công việc khác đi theo nội dung output.
8. Kiểm tra Báo cáo tuần/chart không vỡ layout.
9. Mở Thu chi và Sổ quỹ để xác nhận không bị thay đổi bởi F23B.
10. Reload app: checklist có thể mất theo accepted limitation runtime-state-only.

## 15. Risks / limitations

- Persistence checklist chưa có trong F23B; đây là accepted limitation để tránh tạo storage mới thiếu QA.
- File `src/report-module.js` có lịch sử text tiếng Việt cũ trong repo; F23B chỉ thêm/đổi các text mới đúng theo feedback, không normalize toàn file để tránh refactor ngoài scope.
- Manual QA cần xác nhận layout mobile/desktop của box checklist.
- Nếu cần persist theo center/date, nên mở phase nhỏ sau QA và dùng key riêng `ichessCenterOS.dailyReportTasks.<centerId>`.

## 16. Next recommendation

Nếu F23B smoke/build PASS: user chạy manual QA F23B.

Nếu manual QA pass hoặc accepted limitation được chấp nhận: GO for F23C — Nhóm Tài chính wrapper UI, không merge logic Thu chi/Sổ quỹ.

Nếu manual QA phát hiện layout hoặc persistence là bắt buộc: dừng trước F23C và xử lý F23B follow-up hẹp.
