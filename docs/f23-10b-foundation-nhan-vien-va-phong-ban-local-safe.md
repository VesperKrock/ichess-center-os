# F23.10B - Foundation Nhân viên và Phòng ban local-safe

F23.10B STATUS: STAFF AND DEPARTMENT FOUNDATION
F23_10A_DESIGN_READ: YES
RUNTIME_CHANGED: YES
AUTH_SUPABASE_SQL_DEPLOY_CHANGED: NO
TEACHER_ID_CHANGED: NO
TEACHER_TKB_ATTENDANCE_PORTAL_CHANGED: NO
ACCOUNT_LIFECYCLE_CHANGED: NO
PUBLIC_STAFF_MODULE_ID: nhan-vien
MODULE_14_USED: NO
CENTER_STAFF_MEMBERS_STORAGE: YES
CENTER_DEPARTMENTS_STORAGE: YES
ARCHIVE_INSTEAD_OF_HARD_DELETE: YES
TEACHER_ACCOUNT_LINKS_READ_ONLY: YES
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Module Shell

F23.10B dùng public module hiện có `nhan-vien`. Không tạo route riêng, không tạo module desktop bí mật, không dùng identifier dành cho workspace giáo viên. Launcher, window, taskbar, focus, minimize, maximize và close vẫn đi qua shell chung trong `src/main.js`.

`renderWindowBody` truyền dữ liệu mới vào `renderStaffModule`:

- `staffMembers`
- `staffDepartments`
- `teachers` chỉ để hiển thị trạng thái liên kết read-only
- `scheduleSessions/sessionReports` để giữ phần chấm công suy ra từ lịch dạy
- `staffFilters`, form state và department panel state

## 2. Storage Keys

Thêm hai key center-scoped trong `src/storage.js`:

- `ichessCenterOS.centerStaffMembers.<centerId>`
- `ichessCenterOS.centerDepartments.<centerId>`

Helper mới:

- `getStoredCenterStaffMembers`
- `saveStoredCenterStaffMembers`
- `getStoredCenterDepartments`
- `saveStoredCenterDepartments`
- `normalizeCenterStaffMembers`
- `normalizeCenterDepartments`

Hai helper dùng cùng `createCenterScopedStorageKey` với các module local hiện có. `reloadLocalDataForResolvedCenter` load lại staff/departments khi đổi cơ sở, và `resetTransientStateForCenterSwitch` đóng form/panel đang mở để tránh save nhầm center.

## 3. Staff Schema

Staff record local-safe:

```js
{
  id,
  centerId,
  employeeCode,
  fullName,
  phone,
  email,
  departmentId,
  positionTitle,
  employmentType,
  employmentStatus,
  startDate,
  endDate,
  teacherId,
  accountUserId,
  membershipId,
  note,
  createdAt,
  updatedAt,
  archivedAt
}
```

Normalizer preserve unknown fields bằng cách giữ spread record cũ rồi chuẩn hóa các field F23.10B quản lý. Optional `teacherId`, `accountUserId`, `membershipId` được preserve nhưng UI không có action link/unlink.

## 4. Department Schema

Department record local-safe:

```js
{
  id,
  centerId,
  name,
  code,
  description,
  status,
  sortOrder,
  createdAt,
  updatedAt,
  archivedAt
}
```

Department không hard-delete. Archive giữ ID, giữ nhân viên đang tham chiếu, và form nhân viên không cho chọn archived department cho hồ sơ mới. Nếu hồ sơ cũ đang giữ archived department thì UI hiển thị rõ trạng thái lưu trữ.

## 5. Enums

Loại hình làm việc:

- `unspecified`: Chưa xác định
- `full-time`: Toàn thời gian
- `part-time`: Bán thời gian
- `collaborator`: Cộng tác viên
- `contract`: Hợp đồng

Trạng thái làm việc:

- `active`: Đang làm việc
- `on-leave`: Tạm nghỉ
- `terminated`: Đã nghỉ việc
- `archived`: Đã lưu trữ

Department status:

- `active`
- `archived`

Các enum này không dùng làm authorization.

## 6. CRUD Lifecycle

Staff create/edit:

- Mở form bằng scoped marker `data-staff-action`.
- Gõ input chỉ update draft state, không full render.
- Submit collect DOM latest.
- Đọc latest storage trước save.
- Guard center/stale/duplicate.
- Create append đúng một record.
- Edit replace đúng record, preserve `id`, `createdAt`, unknown fields và optional IDs.
- `updatedAt` đổi khi save.

Staff archive/restore:

- Archive set `employmentStatus = archived`, `archivedAt`, không xóa record.
- Restore set lại `employmentStatus = active`, giữ ID.
- Không cascade sang giáo viên, tài khoản, lịch, điểm danh hoặc chứng từ.

Department CRUD:

- Panel `Phòng ban` trong module Nhân viên.
- Create/edit validate name/code.
- Archive/restore giữ ID.
- Restore kiểm tra conflict latest trước khi bật lại active.

## 7. Uniqueness

Staff:

- `employeeCode` optional.
- Nếu có, unique case-insensitive trong current center.
- Archived record vẫn chặn duplicate.
- Edit chính record hiện tại không bị coi là duplicate.

Department:

- `name` bắt buộc, unique case-insensitive trong current center.
- `code` optional, unique case-insensitive trong current center.
- Không tự thêm hậu tố để che duplicate.

## 8. Read-only Link Status

List staff hiển thị:

- Giáo viên: `Đã liên kết`, `Chưa liên kết`, hoặc `Liên kết không hợp lệ` nếu có `teacherId` nhưng lookup read-only không thấy teacher.
- Tài khoản: `Đã liên kết` nếu có `accountUserId` hoặc `membershipId`, ngược lại `Chưa liên kết`.

Form edit chỉ hiển thị trạng thái read-only. Phase này không có action link/unlink, không tạo account, không cấp role và không revoke membership.

## 9. Focus And Taskbar Safety

Launcher vẫn dùng marker thật `data-module-launcher`. Staff CRUD dùng marker riêng:

- `data-staff-action`
- `data-staff-form-field`
- `data-staff-department-action`
- `data-staff-department-field`

Không thêm selector chung `[data-module-id]`. Không thêm focus workaround, pointer timeout hack hoặc render sau từng input form.

## 10. Public Guard

F23.10B không thêm route/identifier bí mật của workspace giáo viên vào public runtime. Smoke scan kiểm tra public source không chứa các marker cấm, không thêm Auth signup, không SQL và không account lifecycle action.

## 11. Tests

Thêm smoke:

`tests/f23-10b-foundation-nhan-vien-va-phong-ban-local-safe-smoke.js`

Smoke kiểm tra:

- module `nhan-vien` public được wire;
- storage `centerStaffMembers` và `centerDepartments`;
- center-scoped local storage;
- normalizer preserve unknown fields;
- stable IDs;
- duplicate employee code/name/code;
- staff/department create-edit/archive-restore helpers;
- HTML escape;
- không có link/unlink/account action;
- focus/taskbar markers;
- public guard markers.

## 12. Limits

Chưa làm trong F23.10B:

- Liên kết nhân viên với giáo viên.
- Tạo nhân viên từ giáo viên hoặc ngược lại.
- Link account.
- Cấp/sửa role.
- Revoke/restore membership từ staff module.
- Sửa `teacherId`, TKB, Điểm danh, Teacher Portal, account lifecycle, tuition, cashflow hoặc report.

## 13. Roadmap

F23.10C nên triển khai link hồ sơ Nhân viên với hồ sơ Giáo viên bằng stable IDs, có guard same-center và uniqueness. F23.10D/E mới xử lý account/permission visibility và lifecycle nghỉ việc/ngừng dạy/khóa tài khoản đầy đủ.

STAFF AND DEPARTMENT FOUNDATION COMPLETE - AWAITING MANUAL QA
