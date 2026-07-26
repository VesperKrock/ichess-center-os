# F23.8F.1 - Hotfix false center mismatch và hoàn tác kỳ trống

## Root Cause

F23.8F dùng guard trực tiếp `tuitionRecord.centerId !== currentCenterId`. Model Học phí hiện được đọc từ localStorage namespace center-scoped (`ichessCenterOS.tuition.<currentStorageCenterId>`), trong khi nhiều record legacy không có `centerId` hoặc có metadata center cũ. Vì vậy record đang mở từ đúng collection current center vẫn có thể bị báo sai `Hồ sơ học phí không thuộc cơ sở hiện tại`.

## Center Ownership Helper

Hotfix thêm helper `getTuitionRecordCenterOwnership()`. Helper normalize current resolved center, current storage center và các field ownership của record (`centerId`, `sourceCenterId`, `storageCenterId`). Nếu có center id khớp current resolved/storage center thì record hợp lệ.

Không so sánh display name, email, label `DreamHome`, và không hardcode `dreamhome` hoặc `dreamhome_prod`.

## Legacy Provenance Rule

Record thiếu center id hoặc có metadata center legacy chỉ được chấp nhận khi caller truyền provenance `fromCurrentCenterCollection: true`. Provenance này chỉ dùng cho record vừa được đọc từ `getStoredTuition([])` của namespace current center. Record tùy ý thiếu center id mà không có provenance vẫn bị chặn.

Rule này sửa false blocker cho dữ liệu legacy mà không bỏ toàn bộ center guard.

## Shared Guard

Cùng helper ownership được dùng khi mở modal `Hoàn tác kỳ mới` và khi bấm confirm. Eligibility không còn có một rule ở render và rule khác ở confirm.

## Latest Revalidation

Confirm vẫn đọc lại latest record bằng `getStoredTuition([])`, đọc latest cashflow current center, build lại unified attendance records, rồi chạy lại eligibility với `expectedPeriodId`. Nếu period đổi hoặc center đổi, modal hiển thị reason mới và không restore.

## Blocked Button

Khi có blocking reasons:

- modal hiển thị `Chưa thể thực hiện`;
- nút confirm có `disabled` thật;
- disabled style không còn trông như action xanh sẵn sàng;
- handler không return im lặng khi user click một nút nhìn như enabled.

Khi eligible, modal không hiện blocker và nút `Hoàn tác kỳ mới` enabled.

## Restore

Restore vẫn dùng F23.8F algorithm:

- remove current empty period;
- remove previous term khỏi history theo stable identity;
- restore previous term thành current với `currentTermId = previousTerm.id`;
- giữ nguyên used sessions, package, fee, discount, dates, note, payments và legacy panel của previous term;
- không tạo kỳ mới;
- không hardcode số kỳ.

## No Deletion

Undo không xóa cashflow transaction, attachment, cloud object, attendance record hoặc report totals. Nếu current period có payment, attendance, used sessions, legacy paid, refund/void/reversal/correction dependency thì action vẫn bị chặn.

## Manual QA

Trạng thái QA hiện tại cần kiểm:

1. Current period là kỳ mới trống.
2. Previous term nằm trong history và giữ dữ liệu cũ.
3. Bấm `Hoàn tác kỳ mới`.
4. Không còn false reason `Hồ sơ học phí không thuộc cơ sở hiện tại`.
5. Nếu current period thật sự trống, confirm enabled.
6. Confirm restore previous term làm current, giữ stable id và used sessions cũ.
7. Empty period biến mất.
8. Không mất transaction, chứng từ hoặc attendance.

Không kết luận manual PASS trong docs này.

## Tests

Smoke `tests/f23-8f-1-hotfix-false-center-mismatch-va-undo-ky-trong-smoke.js` kiểm:

- eligible modal không có blockers;
- blocked modal có disabled confirm;
- helper ownership/provenance markers;
- render/confirm dùng cùng provenance guard;
- confirm đọc latest record và không xóa cashflow/attendance/attachment;
- disabled style;
- docs markers;
- mojibake scan.
