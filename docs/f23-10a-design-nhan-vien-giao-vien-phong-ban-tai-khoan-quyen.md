# F23.10A - Design Nhân viên, Giáo viên, Phòng ban, Tài khoản và quyền

F23.10A STATUS: DESIGN ONLY
RUNTIME_CHANGED: NO
SCHEMA_MIGRATION_CREATED: NO
DATA_MIGRATION_RUN: NO
AUTH_SUPABASE_SQL_DEPLOY_CHANGED: NO
TEACHER_WORKSPACE_SECRET_TOUCHED: NO
TEACHER_ID_REFACTOR_PLANNED: NO
BACKWARD_COMPATIBLE_ARCHITECTURE: YES
CENTER_STAFF_MEMBERS_DESIGNED: YES
CENTER_DEPARTMENTS_DESIGNED: YES
FOUR_CONCEPTS_SEPARATED: YES
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Scope

F23.10A chỉ chốt thiết kế cho nhân sự, giáo viên, phòng ban, tài khoản đăng nhập và quyền hệ thống. Phase này không sửa runtime, không tạo migration, không chạy dữ liệu, không đổi Auth/Supabase/SQL/deploy và không chạm Teacher Workspace secret.

Kết luận chính: không refactor `teacherId`. Hệ thống đang dùng `teacherId` rộng ở TKB, Điểm danh, Báo cáo buổi học, Module Nhân viên/chấm công và Teacher Portal. Kiến trúc đúng cho F23.10 là thêm mô hình nhân sự center-scoped bên cạnh hồ sơ giáo viên hiện hữu, rồi liên kết bằng stable IDs khi cần.

## 2. Audit Summary

Các file được audit:

- `src/teacher-module.js`: form, validation, build teacher profile, account readiness placeholder.
- `src/teacher-data.js`: seed giáo viên và enum `teacherStatuses`, `teacherTypes`.
- `src/storage.js`: `TEACHERS_KEY = createCenterScopedStorageKey('teachers')`, storage hiện center-scoped theo namespace.
- `src/schedule-module.js`: lịch/ca học lưu `teacherId`, `teacherName`, teacher lookup, conflict theo teacher.
- `src/attendance-records.js`: read-model điểm danh lưu `teacherId`, `teacherName` từ session report hoặc attendance item.
- `src/attendance-board-module.js`: bảng điểm danh hiển thị giáo viên từ attendance/session/student.
- `src/staff-module.js`: Nhân viên hiện tại là chấm công/tổng buổi suy ra từ teachers + scheduleSessions + sessionReports, chưa phải hồ sơ nhân sự.
- `src/supabase-auth.js`: access runtime dựa trên `center_members` active; revoked/paused có denied reason riêng.
- `src/main.js`: account lifecycle owner console, center membership binding, Teacher Portal entry points và các handler teacher/schedule/attendance.
- `docs/supabase-c7-9a-account-lifecycle-readonly-audit.md`, `docs/supabase-c7-9b-persistent-revoked-restore-state.md`: vocabulary active/revoked/paused, restore-after-reload, access denied.
- `docs/c8-1-ho-so-giao-vien-va-teacher-account-model.md`: teacher profile và account readiness model.

## 3. Bốn Khái Niệm Không Được Trộn

1. Hồ sơ Nhân viên: một người làm việc cho cơ sở, thuộc HR/vận hành. Có mã nhân viên, phòng ban, chức danh, trạng thái lao động, ngày vào/nghỉ, hồ sơ nội bộ.
2. Hồ sơ Giáo viên chuyên môn: một người có năng lực/assignment giảng dạy. Đây là entity đang có `teacherId`, chuyên môn, level, khả dụng lịch, trạng thái dạy.
3. Tài khoản đăng nhập: Auth user hoặc login identity. Một giáo viên/nhân viên có thể chưa có tài khoản; khóa tài khoản không xóa hồ sơ nhân sự hoặc giáo viên.
4. Membership/quyền hệ thống: row `center_members` center-scoped với role/status. Đây là nguồn quyền runtime. Chức danh/phòng ban không tự sinh quyền hệ thống.

Các tổ hợp hợp lệ:

- Một người vừa là nhân viên vừa là giáo viên.
- Giáo viên có thể chưa có tài khoản đăng nhập.
- Nhân viên có thể không phải giáo viên.
- Tài khoản có thể có membership/quyền mà chưa được link tới hồ sơ nhân sự ở F23.10B.
- Phòng ban/chức danh chỉ là metadata vận hành, không cấp quyền app.

## 4. Teacher Schema Hiện Tại

Teacher profile hiện có các nhóm field chính:

- Identity/contact: `id`, `fullName`, `displayName`, `phone`, `email`, `loginEmail`.
- Personal/profile: `birthYear`, `hometown`, `currentArea`.
- Teaching state: `status` gồm `active`, `paused`, `inactive`; `teacherType` gồm `fulltime`, `parttime`, `collaborator`.
- Teaching capabilities: `specialties`, `levels`, `teachingGroups`, `teachingModes`, `strengths`, `internalTags`.
- Schedule readiness: `availableDays`, `preferredTimeSlots`, `availableClassSessionIds`, `maxSessionsPerWeek`, `canTakeNewClass`, `acceptNewStudents`, `scheduleNote`.
- Role copy: `mainRole`, hiện là mô tả nghề nghiệp, không phải system role.
- Account readiness placeholder: `accountStatus`, `accountLinkedAt`, `accountUserId`, `accountNotes`.
- Denormalized teaching links: `assignedClassNames`, `assignedStudentIds`, `currentStudentCount`.
- Audit timestamps: `createdAt`, `updatedAt`.

Thiết kế F23.10A giữ nguyên ý nghĩa `teachers.id`: stable ID của hồ sơ giáo viên chuyên môn trong center hiện tại.

## 5. teacherId Usage Contracts

`teacherId` đang là khóa nghiệp vụ trong nhiều luồng:

- TKB/ca học: session form chọn teacher, lưu `teacherId` và `teacherName`; conflict cảnh báo khi trùng giáo viên; UI detail lookup teacher bằng `teacherId`.
- Điểm danh: session reports và attendance read-model giữ `teacherId`, `teacherName` để render bảng điểm danh, trạng thái học và detail.
- Học viên: `assignedTeacherId` trỏ tới teacher hiện hữu; lịch ưu tiên/suggest học viên theo giáo viên.
- Teacher Portal: shell và các entry point đọc giáo viên/ca dạy theo `teacherId`; portal không phải account lifecycle đầy đủ.
- Module Nhân viên/chấm công hiện tại: build person key dạng `teacher:<teacherId>` khi dòng chấm công có giáo viên.

Do đó không đổi `teacherId`, không chuyển TKB/attendance sang staff ID trong F23.10. Staff linkage chỉ bổ sung optional để HR biết giáo viên nào cũng là nhân viên.

## 6. Account Membership And Roles

Runtime access hiện dựa vào `center_members`:

- `resolveActiveCenterMembership(userId)` đọc membership theo user, chỉ cho active membership đi tiếp.
- Revoked/paused/no membership trả denied reason và message riêng.
- Owner/internal account flows C7.9 dùng lifecycle `active`, `revoked`, `paused`; revoke là rút quyền center-scoped, không disable Auth user toàn cục.
- Role hiện có trong code/docs gồm `owner`, `center_admin`, `teacher`, `consultant` và có thể mở rộng sau.

F23.10 không biến chức danh HR thành role. Ví dụ `Trưởng phòng học thuật` không tự có role `center_admin`; phải có row membership/role explicit.

## 7. Existing Staff And Department Foundation

Module `nhan-vien` hiện trong `src/modules.js` là module chấm công. `src/staff-module.js` lấy dữ liệu từ:

- `teachers`
- `scheduleSessions`
- `sessionReports`

Nó chưa có persistent `centerStaffMembers`, chưa có `centerDepartments`, chưa quản lý hồ sơ lao động, chưa có lifecycle nghỉ việc/ngừng dạy/khóa tài khoản. Vì vậy F23.10B nên coi module Nhân viên hiện tại là reporting/chấm công legacy view và thêm một HR surface mới hoặc tab hồ sơ rõ ràng, không ghi đè logic chấm công.

Không tìm thấy canonical department schema hiện hữu. Các field kiểu phòng/room/title trong lịch không phải phòng ban nhân sự.

## 8. Architecture Options

Option A - gom giáo viên vào nhân viên, đổi mọi nơi sang staffId:

- Bị loại. Rủi ro cao vì `teacherId` đang là contract rộng của TKB/Điểm danh/Teacher Portal.

Option B - giữ `teachers`, thêm `centerStaffMembers` và link optional 1:1:

- Chọn. Backward-compatible, ít phá luồng hiện hữu, thể hiện đúng việc một người có thể vừa là nhân viên vừa là giáo viên.

Option C - chỉ thêm field HR vào teacher:

- Bị loại. Làm nhân viên không phải giáo viên bị lệch model, trộn chức danh/phòng ban với năng lực dạy.

## 9. Canonical Decision

F23.10B-E nên triển khai theo Option B:

- `teachers` tiếp tục là hồ sơ giáo viên chuyên môn. `teachers.id` tiếp tục là `teacherId`.
- Thêm `centerStaffMembers` cho hồ sơ nhân viên/nhân sự.
- Thêm `centerDepartments` cho phòng ban.
- Link optional 1:1 bằng stable IDs, không match bằng tên/email/SĐT.
- Link chính nên lưu ở `centerStaffMembers.teacherId` để HR profile biết người này có hồ sơ giáo viên. Teacher UI có thể reverse lookup theo `teacherId`; chưa cần ghi `staffMemberId` vào teacher để tránh drift hai chiều.
- Account link nên explicit bằng `accountUserId` và/hoặc `membershipId` khi có cloud/member data; không suy ra từ email.
- Role/quyền chỉ đọc từ membership, không suy ra từ `departmentId`, `positionTitle`, `teacherType` hoặc `mainRole`.

## 10. Proposed centerDepartments Schema

```js
{
  id,              // stable: dept-...
  centerId,        // explicit for cloud parity even when localStorage key is center-scoped
  code,            // unique per center among active departments
  name,            // unique-ish display name per center; archived name can be reused only with review
  description,
  status,          // active | archived
  sortOrder,
  createdAt,
  updatedAt,
  archivedAt
}
```

Initial department examples should be product defaults, not hardcoded center-specific behavior: Học thuật, Vận hành, Tư vấn, Kế toán, Ban quản lý.

## 11. Proposed centerStaffMembers Schema

```js
{
  id,                 // stable: staff-...
  centerId,
  employeeCode,       // unique per center among non-archived staff
  fullName,
  displayName,
  phone,
  email,
  departmentId,       // optional, references centerDepartments.id
  positionTitle,      // job title only, not system role
  employmentType,     // fulltime | parttime | collaborator | contractor | intern | other
  employmentStatus,   // active | onboarding | paused | terminated | archived
  startDate,
  endDate,
  teacherId,          // optional 1:1 link to teachers.id in same center
  accountUserId,      // optional Auth user id, never inferred from email
  membershipId,       // optional future membership id if exposed
  accountEmailSnapshot,
  accountRoleSnapshot,
  accountStatusSnapshot,
  emergencyContact,
  note,
  createdAt,
  updatedAt,
  archivedAt
}
```

Sensitive HR fields such as contract files, salary, ID documents and bank account details should not be added in F23.10B. If later required, they need a separate privacy/security design.

## 12. Link Rules

Staff-to-teacher:

- Optional.
- 1 staff can link to at most 1 teacher in the same center.
- 1 teacher can link to at most 1 active/non-archived staff member in the same center.
- Link/unlink does not delete either record.
- Link must use IDs selected from controlled UI, not text matching.
- If a teacher is archived/inactive, existing historical staff link can remain for audit but UI must warn before assigning new teaching work.

Staff-to-account:

- Optional.
- Link by Auth user id or membership id when available.
- Email is display/search helper only, not canonical identity.
- Lock/revoke account changes membership/access status, not staff employment status.
- Staff termination may prompt account review, but must not silently revoke access.

Teacher-to-account:

- Existing `teachers.accountStatus/accountUserId/loginEmail` are readiness fields from C8.1.
- F23.10 should not create Teacher Portal login by side effect of making a teacher or staff record.
- Future teacher portal access requires both an active membership/role and a valid link to teacher profile, otherwise the portal cannot safely filter “lịch của tôi”.

## 13. Uniqueness And Center Scope

All new entities are center-scoped:

- Local-first key proposal: `ichessCenterOS.centerStaffMembers.<centerId>` and `ichessCenterOS.centerDepartments.<centerId>`, matching `createCenterScopedStorageKey`.
- Store `centerId` inside records too for future cloud parity and cross-center safety checks.
- No cross-center staff-teacher-account links.
- `employeeCode` unique per center among active/non-archived staff.
- `department.code` unique per center among active departments.
- `teacherId` link unique per center among active/non-archived staff.
- `accountUserId` link unique per center among active/non-archived staff unless product explicitly supports shared service accounts; default is no shared accounts.

Legacy records missing `centerId` may be treated as belonging to the currently scoped storage namespace only when loaded from that center-scoped key. Do not infer cross-center ownership from missing `centerId` alone.

## 14. Lifecycle

Create staff:

- Create `centerStaffMembers` only.
- Optional select department.
- Optional link existing teacher.
- Optional display account lookup/link if account data is available.
- No account creation unless a later F23.10D action explicitly performs that lifecycle.

Create teacher:

- Continue creating teacher profile with current module.
- Optional later action can link to existing staff.
- Do not auto-create staff unless user chooses “Tạo hồ sơ nhân viên từ giáo viên”.

Link:

- User picks target record by list/detail.
- UI shows both IDs and display fields before confirm.
- Guard same center and uniqueness.

Tách liên kết:

- Remove only link fields.
- Preserve staff, teacher, account and historical records.

Nghỉ việc:

- Set staff `employmentStatus = terminated`, `endDate`, optional `archivedAt`.
- Do not delete attendance, cashflow, chứng từ, reports or teacher record.
- Prompt follow-up checklist: ngừng dạy nếu applicable, review account access, remove from future roster.

Ngừng dạy:

- Set teacher `status = inactive` or `paused`.
- Block/surface warning for new teaching assignment.
- Does not terminate staff if the person still works in another department.

Khóa/thu hồi tài khoản:

- Membership/account lifecycle only.
- Do not delete staff/teacher.
- Use C7.9 vocabulary and confirmation patterns.

Archive:

- Archive hides from default operational lists.
- Historical TKB/attendance/cashflow/report still resolve display snapshot or archived profile when needed.

## 15. UI Design

Module Nhân viên future layout:

- Tab `Hồ sơ`: list staff with employee code, name, department, position, employment status, teacher link, account status.
- Tab `Phòng ban`: manage departments, sort order, archive.
- Tab `Chấm công`: preserve current F22 staff attendance view, renamed/positioned so users understand it is derived from lịch dạy and reports.

Staff detail:

- Sections: Thông tin nhân sự, Phòng ban/chức danh, Liên kết giáo viên, Tài khoản/quyền, Lịch sử trạng thái.
- Account section displays Auth/membership state separately from HR fields.
- Teacher section shows linked teacher profile and actions `Mở hồ sơ giáo viên`, `Liên kết`, `Tách liên kết`.

Teacher module:

- Keep existing teacher list/forms.
- Add future read-only badge/field “Có hồ sơ nhân viên” by reverse lookup.
- Do not move teacher-specific scheduling fields into staff form.

Account management:

- Owner/admin account UI remains the only place for create/reset/revoke/restore until F23.10D defines staff-linked account flows.
- If F23.10D adds account actions from Staff detail, actions must route to the same account lifecycle guards and copy, not duplicate a new permission model.

## 16. Role Matrix

| Concept | Stored In | Grants App Access | Used For |
| --- | --- | --- | --- |
| Phòng ban | `centerDepartments` | No | Organization, filtering, reporting |
| Chức danh | `centerStaffMembers.positionTitle` | No | HR display and workflow routing |
| Giáo viên chuyên môn | `teachers` | No by itself | TKB, Điểm danh, Teacher Portal profile filtering |
| Tài khoản đăng nhập | Auth user | No by itself | Identity/login credential |
| Membership/quyền | `center_members` | Yes when active and role allowed | Runtime authorization |

Example decisions:

- Staff in department `Kế toán` still needs explicit role/membership to access Thu chi.
- Teacher with `teacherType = fulltime` still cannot access Teacher Portal unless account/membership/link are valid.
- Account with `center_admin` role can administer center even if not linked to staff, until policy later requires HR linking.

## 17. Migration And Backward Compatibility

F23.10A does not run migration. Future F23.10B/C migration plan:

1. Add storage helpers for `centerStaffMembers` and `centerDepartments`.
2. Seed empty arrays or product default departments per center, without modifying teacher records.
3. Add optional action `Tạo hồ sơ nhân viên từ giáo viên` with preview.
4. Pre-fill staff draft from teacher display fields, but keep new `staff.id`.
5. Save explicit `staff.teacherId = teacher.id`.
6. Do not bulk auto-create staff from teachers on app load.
7. Do not match by name/email/SĐT. If multiple possible matches exist, require manual selection.
8. Keep historical TKB/attendance records on `teacherId`.

Rollback safety:

- Removing the new staff/departments storage must not affect teachers, schedule, attendance, tuition, cashflow, reports or account membership.
- If link data is corrupted, teacher workflows still work because `teacherId` remains canonical for teaching.

## 18. Archive And History Safety

Historical records must never depend on live HR state for meaning:

- TKB/session report should keep `teacherId` and `teacherName` snapshot behavior.
- Attendance rows should remain readable when staff/teacher/account is archived.
- Cashflow/chứng từ are not staff-owned in this phase and must not be deleted by HR lifecycle.
- Account revoke/restore writes access lifecycle, not HR archive.
- Staff archive should not erase `teacherId` history.

## 19. Error And Guard Copy

Future implementation should avoid silent failures:

- Link blocked: “Không thể liên kết vì hồ sơ giáo viên đã được gắn với nhân viên khác trong cơ sở này.”
- Cross-center blocked: “Không thể liên kết hồ sơ khác cơ sở.”
- Account unavailable: “Không đọc được trạng thái tài khoản/quyền. Hồ sơ nhân sự vẫn được lưu, nhưng chưa thể liên kết tài khoản.”
- Revoke not allowed: “Chức danh/phòng ban không cấp quyền. Vui lòng dùng quản lý tài khoản để thu hồi quyền hệ thống.”

## 20. Roadmap F23.10B-E

F23.10B - Staff and Department foundation:

- Add storage/data helpers and UI for `centerStaffMembers`, `centerDepartments`.
- Preserve existing chấm công tab.
- No account creation/revoke.

F23.10C - Staff/Teacher link:

- Add controlled link/unlink between staff and teacher.
- Add teacher detail badge/read-only staff link.
- Add uniqueness and same-center guards.

F23.10D - Account link and permission visibility:

- Show account/membership state from C7.9-style lifecycle.
- Link staff/teacher to account by stable user/membership ID where available.
- Keep role assignment explicit; do not infer from department/title.

F23.10E - Lifecycle safety:

- Implement nghỉ việc/ngừng dạy/tách liên kết/khóa tài khoản boundaries.
- Add history/audit surfaces and blocking copy.
- Verify no deletion of attendance, cashflow, chứng từ or teacher history.

## 21. Checks For This Design Phase

Required verification for F23.10A:

- Docs marker check for this file.
- `git diff --check`.
- Mojibake scan on this file.
- `npm run build`.

No `node --check` is required for runtime files because F23.10A does not change JavaScript.

DESIGN COMPLETE - READY FOR F23.10B
