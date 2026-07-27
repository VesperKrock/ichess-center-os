# F23.10E - Vòng đời Nhân viên, Giáo viên, tài khoản và lịch sử

## Phạm vi

F23.10E bổ sung vòng đời Nhân viên trên nền F23.10A-D. Phase này chỉ thay đổi dữ liệu local của `centerStaffMembers`; hồ sơ Giáo viên, account và membership được đọc để hiển thị hoặc deep-open bằng stable ID. Không có thao tác tạo/xóa account, đổi role, đổi membership, thay đổi Auth hay ghi dữ liệu cloud.

## Mô hình trạng thái

`employmentStatus` có ba giá trị canonical và độc lập với lưu trữ hồ sơ:

| Giá trị | Hiển thị | Quy tắc ngày kết thúc |
| --- | --- | --- |
| `active` | Đang làm việc | Xóa giá trị hiện tại, UI hiển thị `Đến nay` |
| `on-leave` | Tạm nghỉ | Xóa giá trị hiện tại, UI hiển thị `Đến nay` |
| `terminated` | Đã nghỉ việc | Dùng ngày hiệu lực; không được trước ngày bắt đầu nếu đã có ngày bắt đầu |

Trạng thái lưu trữ được xác định bằng `archivedAt`. Lưu trữ và khôi phục không đổi `employmentStatus`, `endDate`, lịch sử, `teacherId`, `accountUserId`, `membershipId` hay field không thuộc ownership của phase này.

Record legacy có `employmentStatus: archived` được normalizer đọc thành trạng thái làm việc trong `employmentStatusBeforeArchive` nếu hợp lệ, nếu không thì dùng `active`, đồng thời giữ trạng thái lưu trữ qua `archivedAt`. Đây là tương thích khi đọc, không tạo lifecycle event giả.

## Transition và lịch sử

Các transition được hỗ trợ:

- `active` sang `on-leave` hoặc `terminated`.
- `on-leave` sang `active` hoặc `terminated`.
- `terminated` sang `active`.

Không cho lưu cùng trạng thái hoặc transition ngoài ma trận. Mỗi lần lưu thành công append đúng một phần tử vào `employmentLifecycleEvents`:

```js
{
  id,
  fromStatus,
  toStatus,
  effectiveDate,
  note,
  createdAt,
  createdBy,
  createdByLabel,
}
```

Event mới luôn có stable ID. Mảng cũ và field lạ trong record/event được giữ nguyên; event malformed được giữ để kiểm tra và UI không in raw ID hoặc ngày lỗi. Record legacy không có history hiển thị trạng thái rỗng thay vì backfill suy đoán.

## Card trạng thái và vòng đời

Card trong form sửa Nhân viên hiển thị riêng:

- Trạng thái làm việc của Nhân viên.
- Trạng thái hồ sơ Giáo viên theo `teacherId`.
- Trạng thái account và membership theo `accountUserId` + `membershipId`.
- Trạng thái lưu trữ hồ sơ.

Card cảnh báo các tổ hợp không nhất quán nhưng không tự sửa: Nhân viên nghỉ việc trong khi Giáo viên/membership còn hoạt động, hoặc Nhân viên đang làm việc trong khi Giáo viên đã ngừng dạy/membership không hoạt động.

`Chức danh` vẫn là dữ liệu nhân sự; `Quyền hệ thống` vẫn đến từ membership và không được sao chép vào Nhân viên.

## Xử lý nghỉ việc

Flow `Xử lý nghỉ việc` chỉ chuyển Nhân viên sang `terminated`, đặt ngày kết thúc và append history. Checklist nhắc rõ hồ sơ Giáo viên và tài khoản không đổi.

Sau khi lưu, admin chọn tối đa một follow-up bằng radio:

- Không mở thêm hồ sơ.
- Mở đúng hồ sơ Giáo viên bằng `teacherId`.
- Mở quản lý tài khoản bằng canonical account/membership stable IDs và guard hiện có của F23.10D/C7.9.

Thiết kế một-lựa-chọn tránh hai cửa sổ điều hướng cạnh tranh. Việc mở follow-up không phải mutation và luôn diễn ra sau khi Nhân viên đã lưu thành công.

## Guard khi lưu

- Khóa double-submit bằng state riêng của lifecycle.
- Đọc lại record theo stable staff ID ngay trước khi lưu và yêu cầu đúng một match.
- Kiểm tra current center và trạng thái archive mới nhất.
- So sánh snapshot `employmentStatus`, `archivedAt` và toàn bộ lifecycle history để chặn stale transition.
- Build trên record mới nhất để giữ link, account IDs, unknown fields và thay đúng một record.
- Form sửa thông thường lấy lại `employmentStatus` mới nhất từ storage; transition chỉ đi qua lifecycle flow.

## Quan hệ không cascade

- Ngừng dạy hoặc tiếp tục dạy Giáo viên không đổi Nhân viên.
- Membership bị revoke/paused không archive hoặc đổi trạng thái Nhân viên.
- Nhân viên nghỉ việc không ngừng dạy, gỡ link, revoke hay khóa account.
- Archive Nhân viên không tạo event nghỉ việc và không cascade.
- Reactivate Nhân viên không tự reactivate Giáo viên hoặc membership.

## Manual QA trọng tâm

1. Mở Nhân viên đã liên kết Giáo viên và account; xác nhận card hiển thị ba nguồn trạng thái độc lập.
2. Chuyển Đang làm việc sang Tạm nghỉ; xác nhận ngày kết thúc là `Đến nay` và history thêm đúng một event.
3. Chuyển Tạm nghỉ sang Đã nghỉ việc; xác nhận ngày kết thúc bắt buộc hợp lệ và không trước ngày bắt đầu.
4. Trong flow nghỉ việc, chọn mở Giáo viên hoặc tài khoản; xác nhận save Nhân viên xong mới deep-open đúng stable ID.
5. Xác nhận trạng thái Giáo viên, membership, role và các link không đổi sau nghỉ việc.
6. Chuyển Đã nghỉ việc sang Đang làm việc; xác nhận end date được clear nhưng event nghỉ việc cũ còn nguyên.
7. Lưu trữ rồi khôi phục record ở từng trạng thái; xác nhận employment status/history/link giữ nguyên.
8. Mở modal, thay đổi record ở tab khác rồi lưu; xác nhận stale guard báo lỗi và không append event.
