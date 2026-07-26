# F23.10D - Liên kết Nhân viên với tài khoản, membership và hiển thị quyền

F23.10D STATUS: STAFF ACCOUNT MEMBERSHIP LINK
F23_10A_B_C1_READ: YES
CANONICAL_ACCOUNT_ID: center_members.user_id
CANONICAL_MEMBERSHIP_ID: center_members.id
CANONICAL_STAFF_LINK: centerStaffMembers.accountUserId+membershipId
ROLE_SOURCE_OF_TRUTH: center_members.role
AUTH_WRITE_CHANGED: NO
SUPABASE_SQL_DEPLOY_CHANGED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Audit thực tế

Account identity canonical là Auth `user.id`, được membership tham chiếu qua `center_members.user_id`. Email không phải foreign key. Read helper mới ưu tiên `center_members.email_snapshot`, dùng email của phiên Auth chỉ khi row thuộc chính user đang đăng nhập, và không match staff bằng email, tên hoặc số điện thoại.

Schema membership đã có `id`, `user_id`, `center_id`, `role`, `status`, `created_at`, `updated_at`. Runtime role hiện hữu gồm `owner`, `qtv`, `center_admin`, `teacher`, `consultant`, `viewer`; alias `admin` được normalize về quyền quản lý cơ sở. Lifecycle thực tế có `active`, `revoked`, `paused`; schema cũ còn có thể gặp `inactive`, `suspended`, `disabled`. Chỉ `active` được tạo liên kết mới. Link cũ với status khác vẫn được giữ và hiển thị.

`src/member-profiles.js` đọc directory membership current-center qua RLS đã có. Helper thử profile fields tùy chọn rồi fallback về cột membership tối thiểu, nhưng luôn yêu cầu stable membership `id`. Nguồn hiện tại không cung cấp trạng thái khóa/banned Auth cho mọi user, vì vậy UI hiển thị `Chưa có dữ liệu` thay vì suy đoán.

Current center được lấy từ account membership binding và phải trùng namespace local storage. Không fallback chéo `dreamhome`/`dreamhome_prod` khi link hoặc unlink.

## 2. Canonical link

Staff chỉ lưu:

```js
{
  accountUserId,
  membershipId,
  accountLinkedAt
}
```

Role, email và status không được copy vào staff làm source of truth. Staff normalizer giữ `accountLinkedAt`; staff edit/archive tiếp tục preserve account link, `teacherId`, timestamps và unknown fields.

Reverse lookup `findStaffMemberByMembershipId` và `findStaffMemberByAccountUserId` dùng stable IDs, current-center scope, phát hiện duplicate và không mutate input. Legacy staff thiếu `centerId` vẫn được coi thuộc namespace center-scoped đang đọc; center ID khác thật bị chặn.

## 3. UI Tài khoản và quyền

Form Nhân viên có card `Tài khoản và quyền`, tách rõ:

- `Chức danh`: metadata nhân sự từ `positionTitle`.
- `Quyền hệ thống`: role mới nhất từ membership.

Card chưa link hiển thị `Tài khoản: Chưa liên kết`, `Quyền hệ thống: Chưa có`. Card đã link hiển thị email nếu nguồn có, tên hiển thị nếu có, trạng thái account, trạng thái membership, cơ sở, quyền hệ thống và thời điểm liên kết. Raw user ID và membership ID không xuất hiện trên UI.

Malformed/stale/cross-center/duplicate link hiển thị `Liên kết tài khoản cần kiểm tra`; runtime không tự sửa và không tự clear.

## 4. Selector và one-to-one

Selector chỉ đọc membership current center có stable membership ID, stable account user ID và role hợp lệ. Search chỉ dùng email/tên hiển thị để lọc; không auto-select hoặc auto-link khi email trùng staff.

Membership active chưa được staff khác dùng có action `Chọn`. Revoked/paused/inactive/suspended/disabled vẫn hiển thị ở nhóm không hoạt động nhưng bị disable với copy `Membership hiện không hoạt động`.

Link confirm đọc lại latest center, staff và membership; kiểm tra staff tồn tại duy nhất, membership tồn tại duy nhất, đúng account, đúng center, active, chưa được staff khác dùng và không có duplicate malformed. Save map thay đúng một staff record, giữ mọi field khác và không mutate account/membership/role.

## 5. Gỡ liên kết

Gỡ link dùng confirmation giải thích staff, account, membership, role và đăng nhập vẫn còn. Sau confirm, handler đọc lại latest staff/membership và so sánh đúng cặp stable IDs đang mở. Save chỉ clear `accountUserId`, `membershipId`, `accountLinkedAt`, cập nhật `updatedAt`, không revoke, disable, delete hoặc đổi role.

Malformed link không được tự gỡ; cần review dữ liệu trước.

## 6. Teacher consistency

Card chỉ cảnh báo, không mutate:

- Role `teacher` nhưng staff chưa có `teacherId`: `Tài khoản có quyền Giáo viên nhưng chưa liên kết hồ sơ Giáo viên.`
- Staff có `teacherId` nhưng role không phải `teacher` hoặc role quản trị cấp cao: `Tài khoản hiện chưa có quyền Giáo viên.`
- `owner`, `qtv`, `admin`, `center_admin` có Teacher profile không bị false warning do hệ thống là single-role với quyền quản trị cao hơn.

Không tự cấp role, không tạo/link Teacher profile và không ghi account IDs lên teacher record.

## 7. Quản lý tài khoản hiện có

Account lifecycle C7.9 hiện nằm ở Internal Center Console và chỉ quản lý `center_admin`. Action `Mở quản lý tài khoản` xác minh link bằng stable IDs. Với account `center_admin` và actor `owner`, route hiện có được mở và card đúng user được focus bằng `user_id`, không tìm bằng email.

Các role khác chưa có stable-ID deep-open trong account lifecycle UI; runtime báo giới hạn rõ và không giả vờ đã chọn đúng account. Đây là polish debt cho account directory chung sau này.

## 8. Safety boundary

- Center switch reset directory, modal, selection, saving state và invalidates request cũ.
- Link/unlink có in-flight guard, disabled state và latest-read guard; không dùng timeout.
- Staff archived giữ link nhưng không được tạo link mới.
- Membership bị revoke sau khi link vẫn giữ reference và chỉ đổi trạng thái hiển thị.
- Không tạo account, gửi lời mời, reset password, khóa Auth, revoke/restore membership, đổi role, sửa SQL/schema, deploy hoặc chạm Teacher Workspace.

## 9. Manual QA

Không gắn owner/admin account cho Nguyễn Trường Thịnh chỉ để thử. Nếu chưa có cặp staff/account đúng cùng người, mở selector rồi Hủy là kết quả đúng.

Khi có cặp an toàn: link từ staff edit, xác nhận card đọc role/status mới nhất, sửa tiếp field nhân sự để kiểm tra link và `teacherId` được giữ, thử Hủy unlink, rồi chỉ confirm unlink nếu muốn bỏ reference. Kiểm tra account vẫn đăng nhập được và role/membership không đổi ngoài staff local record.

F23_10D_STABLE_ACCOUNT_MEMBERSHIP_LINK: YES
F23_10D_ROLE_READONLY_FROM_LATEST_MEMBERSHIP: YES
F23_10D_NO_AUTH_MEMBERSHIP_MUTATION: YES

STAFF ACCOUNT MEMBERSHIP LINK COMPLETE - AWAITING MANUAL QA
