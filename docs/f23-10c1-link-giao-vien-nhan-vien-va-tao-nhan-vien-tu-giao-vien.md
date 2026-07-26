# F23.10C1 - Link Giáo viên với Nhân viên

F23.10C1 STATUS: TEACHER STAFF DIRECT LINK
F23_10A_B_READ: YES
CANONICAL_LINK_FIELD: centerStaffMembers.teacherId
TEACHER_BACKLINK_ADDED: NO
TEACHER_ID_CHANGED: NO
TKB_ATTENDANCE_TEACHER_PORTAL_CHANGED: NO
ACCOUNT_AUTH_MEMBERSHIP_CHANGED: NO
SUPABASE_SQL_DEPLOY_CHANGED: NO
TEACHER_WORKSPACE_SECRET_TOUCHED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Canonical Link

F23.10C1 lưu liên kết một chiều tại `centerStaffMembers[].teacherId`. Teacher record không có backlink độc lập, không thêm `staffMemberId`, và không đổi `teachers.id`. TKB, Điểm danh và Teacher Portal tiếp tục dùng `teacherId` hiện hữu.

Reverse lookup dùng helper `findStaffMemberByTeacherId(staffMembers, teacherId)`. Helper trả trạng thái `unlinked`, `linked` hoặc `duplicate`; nếu duplicate malformed thì UI báo cần review và không tự chọn một record.

## 2. Teacher UI

Teacher profile có card `Hồ sơ nhân viên`:

- Chưa liên kết: hiển thị `Hồ sơ nhân viên: Chưa liên kết` và action `Liên kết hồ sơ nhân viên`.
- Đã liên kết: hiển thị mã/tên staff, action `Mở hồ sơ nhân viên` và `Gỡ liên kết`.
- Duplicate malformed: báo cần review.
- Teacher không active không được tạo link mới.

Modal link có hai mode:

- Chọn staff active chưa có `teacherId`.
- Tạo hồ sơ nhân viên từ giáo viên.

## 3. Create From Teacher

Form tạo staff từ teacher prefill:

- `fullName` từ `teacher.fullName/displayName`.
- `phone` từ `teacher.phone`.
- `email` từ `teacher.email/loginEmail`.
- `employmentType` map từ `teacherType`: `fulltime -> full-time`, `parttime -> part-time`, `collaborator -> collaborator`.
- `employmentStatus` là `active` khi teacher active.
- `positionTitle` gợi ý `Giáo viên`.

Không prefill mã nhân viên giả, department hardcode, account IDs, membership IDs, role hoặc password. Khi submit, tạo đúng một staff record với `teacherId = teacher.id`.

## 4. Existing Staff Link

Link staff có sẵn chỉ cho staff:

- current center;
- chưa archived;
- chưa có `teacherId`;
- không stale.

Khi link existing staff, chỉ set `teacherId`, `teacherLinkedAt`, `updatedAt`; preserve toàn bộ unknown fields, employee data, department và account/membership IDs.

## 5. Staff UI

Staff list hiển thị tên giáo viên thật khi resolve được teacher:

- `Đã liên kết · <Tên giáo viên>`;
- action `Mở hồ sơ Giáo viên`;
- action `Gỡ liên kết`.

Nếu `teacherId` không resolve được, hiển thị `Liên kết Giáo viên không hợp lệ` và không tự clear link.

## 6. Unlink

Gỡ liên kết có confirmation nói rõ:

- hồ sơ Nhân viên vẫn còn;
- hồ sơ Giáo viên vẫn còn;
- TKB/điểm danh không bị xóa;
- tài khoản không bị thay đổi;
- chỉ clear link nhân sự.

Confirm chỉ clear `staff.teacherId` và metadata link F23.10C1, preserve record.

## 7. Safety

Guards đã thêm:

- teacher 1:1 với staff;
- staff 1:1 với teacher;
- current center guard;
- archived staff không link mới;
- inactive teacher không link mới;
- stale teacher/staff guard;
- double-submit guard;
- duplicate malformed link guard;
- no auto-match by name/email/phone.

## 8. Account Boundary

F23.10C1 không tạo tài khoản, không link account, không cấp role, không revoke membership, không sửa Auth/Supabase/SQL/deploy.

Sau khi tạo staff từ teacher, `Tài khoản: Chưa liên kết` vẫn là kết quả đúng nếu staff không có `accountUserId` hoặc `membershipId`.

## 9. Manual QA Fixture

Manual QA có thể dùng giáo viên thật Nguyễn Trường Thịnh với SĐT/email thật trong dữ liệu hiện tại. Fixture này không được hardcode trong runtime hoặc test contract.

Flow QA:

1. Mở Module Giáo viên.
2. Mở giáo viên fixture.
3. Bấm `Liên kết hồ sơ nhân viên`.
4. Chọn `Tạo hồ sơ nhân viên từ giáo viên`.
5. Kiểm tra prefill tên/SĐT/email.
6. Nhập mã nhân viên và các field HR.
7. Bấm `Tạo hồ sơ & liên kết`.
8. Kiểm tra Staff list hiển thị tên giáo viên thật.
9. Kiểm tra mở chéo Staff/Teacher không tạo duplicate window.
10. Chỉ test hủy unlink nếu muốn giữ fixture.

## 10. Tests

Thêm smoke:

`tests/f23-10c1-link-giao-vien-nhan-vien-va-tao-nhan-vien-tu-giao-vien-smoke.js`

Smoke kiểm tra canonical link, no teacher backlink, render actions, prefill, existing staff picker, reverse lookup duplicate, center scoped storage, preserve unknown fields, unlink markers, open cross markers, public guard và mojibake guard.

TEACHER STAFF DIRECT LINK COMPLETE - AWAITING MANUAL QA
