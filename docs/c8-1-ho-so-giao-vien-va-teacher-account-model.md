# C8.1 - Hồ sơ giáo viên và teacher account model

## 1. Trạng thái

```txt
C8.1 STATUS: TEACHER PROFILE AND ACCOUNT MODEL
C8_0_STATUS: TEACHER_PORTAL_DESIGN_DONE
TEACHER_IS_REAL_PERSON: YES
TEACHER_USES_REAL_EMAIL: YES
TEACHER_PUBLIC_SIGNUP_ALLOWED: NO
CENTER_ADMIN_EMAIL_PATTERN_PRESERVED: YES
TEACHER_PROFILE_FIELDS_NORMALIZED: YES
TEACHER_LOGIN_EMAIL_MODELED: YES
TEACHER_AUTH_ACCOUNT_CREATED: NO
TEACHER_PORTAL_LOGIN_CREATED: NO
TEACHER_ACCOUNT_READINESS_UI_ADDED: YES
TEACHER_FORM_UPDATED: YES
TEACHER_PROFILE_UI_UPDATED: YES
SCHEDULE_TKB_CHANGED: NO
CHECKIN_CHECKOUT_CREATED: NO
SQL_CREATED: NO
DEPLOY_BY_CODEX: NO
RUNTIME_CHANGED: YES
COMMIT: NOT RUN
PUSH: NOT RUN
```

C8.1 xây nền hồ sơ giáo viên trong admin Module Giáo viên. Phase này không tạo Auth user thật, không mở public signup, không tạo Teacher Portal login, không chuyển TKB/report session, không làm check-in/check-out và không chạy SQL/deploy.

## 2. Teacher vs admin

Admin cơ sở là tài khoản vận hành cơ sở, dùng email nội bộ như `admin.dreamhome@ichess.vn` hoặc `admin.phongtrong@ichess.vn`. Admin quản lý dữ liệu cơ sở và account management, không đại diện cho một giáo viên cụ thể.

Teacher là người thật, dùng email/Gmail thật như `ducthang.ichess@gmail.com` hoặc `hoangvan@gmail.com`. Teacher có hồ sơ cá nhân/nghề nghiệp, sau này có thể đăng nhập Teacher Portal, nhưng không quản lý cơ sở và không dùng pattern `admin.*`.

Nguyên tắc giữ từ C8.0: Teacher không quản lý cơ sở. Teacher thực hiện ca dạy và báo cáo.

## 3. Hiện trạng Module Giáo viên

Inspection C8.1 ghi nhận Module Giáo viên đã có:

- `fullName`, `displayName`, `phone`, `email`.
- `status`: `active`, `paused`, `inactive`.
- `teacherType`: `fulltime`, `parttime`, `collaborator`.
- `specialties`, `levels`, `teachingGroups`, `teachingModes`.
- `strengths`, `internalTags`.
- `availableDays`, `preferredTimeSlots`, `availableClassSessionIds`, `maxSessionsPerWeek`.
- `canTakeNewClass`, `scheduleNote`, `mainRole`, `note`.
- Link học viên qua `assignedTeacherId`, `assignedStudentIds` và lịch qua `teacherId`.
- Storage normalize trong `src/storage.js` cho teacher list.

Field đã phù hợp với C8.1: trạng thái dạy, loại giáo viên, level phù hợp, hình thức dạy, khả dụng giảng dạy, ghi chú nội bộ.

Field bổ sung trong C8.1:

- `loginEmail`: email đăng nhập tương lai, default từ `email`.
- `birthDate`, `birthYear`, `gender`, `hometown`, `currentArea`, `address`, `avatarUrl`.
- `acceptNewStudents`: alias rõ nghĩa cho `canTakeNewClass`.
- `accountStatus`, `accountLinkedAt`, `accountUserId`, `accountNotes`.

Seed có tiếng Việt có dấu và seed email giáo viên được đổi sang Gmail thật dạng mẫu. Console PowerShell có thể hiển thị mojibake ở file cũ, nhưng C8.1 smoke có targeted mojibake check cho file mới/chạm.

## 4. Data model đã implement

Teacher profile giữ backward compatibility với dữ liệu cũ:

```js
{
  id,
  fullName,
  displayName,
  phone,
  email,
  loginEmail,
  birthDate,
  birthYear,
  gender,
  hometown,
  currentArea,
  address,
  avatarUrl,
  status,
  teacherType,
  specialties,
  levels,
  teachingGroups,
  teachingModes,
  strengths,
  internalTags,
  availableDays,
  preferredTimeSlots,
  maxSessionsPerWeek,
  canTakeNewClass,
  acceptNewStudents,
  scheduleNote,
  note
}
```

Teacher account readiness model:

```js
{
  loginEmail,
  accountStatus,
  accountLinkedAt,
  accountUserId,
  accountNotes
}
```

`accountStatus` hỗ trợ: `not_invited`, `invited`, `active`, `paused`, `revoked`. C8.1 chỉ lưu readiness state và UI copy. `accountUserId` hiện là placeholder rỗng, không trỏ Auth user thật.

## 5. UI changes

Danh sách giáo viên:

- Liên hệ hiển thị phone/email.
- Có readiness nhẹ: `Chưa tạo tài khoản đăng nhập`.
- Không có nút tạo account.

Form thêm/sửa giáo viên:

- Đổi label email thành `Email/Gmail thật`.
- Thêm `Email đăng nhập tương lai`.
- Thêm `Năm sinh`, `Quê quán`, `Khu vực hiện tại`.
- Thêm card `Tài khoản giáo viên` với copy: tài khoản sẽ được bật ở phase sau.
- Validate teacher không dùng pattern `admin.*` cho email đăng nhập tương lai.

Hồ sơ giáo viên:

- Thêm nhóm `Thông tin cá nhân`.
- Thêm `Email đăng nhập tương lai`.
- Thêm card `Tài khoản giáo viên` ở mức readiness.
- Ghi rõ C8.1 chưa tạo Auth user, chưa gửi lời mời và chưa mở Teacher Portal login.

## 6. Account readiness

C8.1 chỉ chuẩn hóa model:

- `loginEmail` là email đăng nhập tương lai, có thể dùng Gmail thật.
- `accountStatus = not_invited` nghĩa là `Chưa tạo tài khoản đăng nhập`.
- Không gọi Supabase Auth Admin.
- Không tạo magic link/OTP.
- Không mở public signup.
- Không tạo membership hoặc assignment thật.

## 7. Không làm trong C8.1

- Không tạo tài khoản teacher.
- Không mời teacher qua email.
- Không public signup.
- Không teacher login.
- Không Teacher Portal.
- Không check-in/check-out.
- Không đổi TKB.
- Không upload ảnh.
- Không Supabase Storage.
- Không teacher assignment multi-center thật.
- Không SQL, không deploy, không Edge Function.

## 8. Manual QA checklist

1. Mở module `Giáo viên`.
2. Bấm `+ Thêm giáo viên`.
3. Nhập họ tên, Gmail thật, số điện thoại, năm sinh/quê quán/khu vực nếu có.
4. Lưu giáo viên.
5. Expected: lưu được, không lỗi form disconnected, danh sách cập nhật.
6. Mở hồ sơ giáo viên.
7. Expected: thấy thông tin cá nhân, thông tin giảng dạy và `Tài khoản giáo viên` ở mức `Chưa tạo tài khoản đăng nhập`.
8. Sửa giáo viên.
9. Reload app.
10. Expected: dữ liệu không mất, field cũ không vỡ.
11. Module Học viên/TKB vẫn hoạt động cơ bản.

## 9. Recommendation C8.2

C8.2 nên làm Teacher login shell + `Lịch dạy của tôi`, nhưng chỉ sau khi chốt teacher access filter: teacher thấy đúng center/session được phân công, không thấy account management, không thấy học phí và không thấy toàn bộ TKB admin.
