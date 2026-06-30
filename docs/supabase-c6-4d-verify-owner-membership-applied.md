# C6.4D - Verify owner membership applied

C6.4D STATUS: VERIFY OWNER MEMBERSHIP APPLIED
C6_4A_STATUS: PASS
C6_4B_STATUS: PASS
C6_4C_STATUS: PASS
OWNER_MEMBERSHIP_APPLIED_BY_USER: YES
OWNER_MEMBERSHIP_APPLIED_BY_CODEX: NO
SQL_APPLIED_BY_USER: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
OWNER_EMAIL: owner.duchai@ichess.vn
OWNER_AUTH_USER_ID: 9683b2c8-3970-4eac-99b3-985d503bdeb9
TARGET_CENTER_ID: dreamhome_prod
TARGET_CENTER_ENVIRONMENT: production
TARGET_CENTER_STATUS: active
TARGET_ROLE: owner
TARGET_MEMBERSHIP_STATUS: active
OWNER_MEMBERSHIP_VERIFIED: YES
OWNER_AUTH_USER_CREATED_BY_CODEX: NO
NEW_CENTER_CREATED: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
RUNTIME_CHANGE: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.4D

C6.4D ghi nhận/verify việc user đã manual apply owner membership thành công trong Supabase. Phase này không apply SQL lại, không gọi Supabase action, không tạo Auth user, không tạo membership mới, không sửa runtime, không tạo center mới, không mở C6.5/C7 và không commit/push.

## 2. Trạng thái sau C6.4C

C6.4C đã PASS với decision:

`CURRENT_APPLY_DECISION: READY TO APPLY IN C6.4D`

Target đã được chốt:

- owner email: `owner.duchai@ichess.vn`
- owner user_id: `9683b2c8-3970-4eac-99b3-985d503bdeb9`
- target center_id: `dreamhome_prod`
- target role: `owner`
- target membership status: `active`

## 3. SQL apply do user chạy thủ công

User đã manual apply SQL trong Supabase để tạo/đảm bảo owner membership cho owner test account.

SQL_APPLIED_BY_USER: YES.

OWNER_MEMBERSHIP_APPLIED_BY_USER: YES.

## 4. SQL apply không do CodeX chạy

CodeX không chạy SQL, không gọi Supabase action và không sửa database/Auth/membership trong C6.4D.

SQL_APPLIED_BY_CODEX: NO.

SUPABASE_ACTION_BY_CODEX: NOT RUN.

OWNER_MEMBERSHIP_APPLIED_BY_CODEX: NO.

## 5. Owner test account

Owner test account:

- owner email: `owner.duchai@ichess.vn`
- owner user_id: `9683b2c8-3970-4eac-99b3-985d503bdeb9`

Auth user này đã do user tạo trước đó. CodeX không tạo/sửa/xóa Auth user.

## 6. Target center

Target center:

- center_id: `dreamhome_prod`
- center_name: `DreamHome`
- slug: `dreamhome`
- environment: `production`
- center_status: `active`

`dreamhome_prod` vẫn là DreamHome production center. C6.4D không tạo center mới.

## 7. Post-apply verification evidence

Evidence user cung cấp sau apply:

- owner email: `owner.duchai@ichess.vn`
- owner user_id: `9683b2c8-3970-4eac-99b3-985d503bdeb9`
- center_id: `dreamhome_prod`
- center_name: `DreamHome`
- slug: `dreamhome`
- environment: `production`
- center_status: `active`
- role: `owner`
- membership_status: `active`
- membership_created_at: `2026-06-30 16:02:42.934826+00`
- membership_updated_at: `2026-06-30 16:02:42.934826+00`

OWNER_MEMBERSHIP_VERIFIED: YES.

## 8. Ý nghĩa của membership owner

Membership `owner` trên `dreamhome_prod` xác nhận owner test account đã có binding rõ ràng theo mô hình membership per center/hybrid của C6.4.

Ý nghĩa trong C6:

- có `user_id` cụ thể;
- có `center_id` cụ thể;
- có `role = owner`;
- có `status = active`;
- không dùng wildcard;
- chưa tự mở Internal Center Console;
- chưa tạo global role/permission system.

## 9. Vì sao không dùng tranduchai@gmail.com

Không dùng `tranduchai@gmail.com` vì tài khoản đó từng dính staging. `owner.duchai@ichess.vn` là owner test account riêng, sạch hơn để kiểm role owner và chuẩn bị C6.5 Internal Center Console.

## 10. Tác động tới dreamhome_prod

`dreamhome_prod` được ghi nhận có owner membership active cho owner test account. Việc này chỉ bổ sung quyền membership, không seed dữ liệu vận hành, không copy dữ liệu staging và không thay đổi runtime app trong C6.4D.

## 11. Tác động tới dreamhome staging / Angel Wings

C6.4D không xóa, không migrate và không copy Angel Wings.

- ANGEL_WINGS_DELETED: NO.
- ANGEL_WINGS_MIGRATED: NO.
- `dreamhome` vẫn là staging/test sandbox.
- `dreamhome_prod` vẫn là production.

## 12. Những gì C6.4D không làm

C6.4D không:

- chạy SQL;
- gọi Supabase action;
- tạo/sửa/xóa Auth user;
- tạo owner membership mới bằng CodeX;
- tạo center mới;
- tạo Gò Vấp;
- tạo Quận 12;
- sửa runtime;
- tạo route `/internal/centers`;
- tạo nút `Thêm cơ sở`;
- mở C6.5 UI;
- mở C7;
- commit/push.

## 13. Manual QA checklist cho C6.4E

Manual QA C6.4E nên kiểm:

- Login `owner.duchai@ichess.vn`.
- Nếu app cho vào dashboard, xác nhận center là DreamHome / `dreamhome_prod`.
- Không thấy Angel Wings staging.
- Không thấy 29 học viên staging.
- Không thấy badge đỏ `3` quay lại.
- Taskbar/profile nếu hiện role thì ghi nhận role `owner`.
- Nếu runtime chưa có owner-specific UI, ghi nhận behavior hiện tại.
- Không kỳ vọng Internal Center Console trước C6.5.

## 14. C6.5 dependency

C6.5 Internal Center Console chỉ nên mở sau khi owner login/readiness được kiểm tra ở C6.4E. C6.4D chỉ verify membership đã apply; chưa tạo UI internal.

## 15. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- global role/permission system;
- permission override;
- acting/support mode;
- Teacher Portal;
- Super Admin/customer-facing concept.

## 16. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/test đầy đủ;
- ghi rõ SQL apply do user chạy;
- ghi rõ CodeX không chạy SQL/Supabase action;
- owner membership verified đúng `owner.duchai@ichess.vn`, `9683b2c8-3970-4eac-99b3-985d503bdeb9`, `dreamhome_prod`, `production`, `owner`, `active`;
- không runtime change;
- không tạo center mới;
- không xóa/migrate Angel Wings;
- không mở C6.5/C7;
- all C6 smokes pass;
- `npm run build` pass;
- `git diff --check` pass;
- không commit/push.

NEEDS REVIEW nếu evidence lệch, thiếu owner membership active, center không phải production, hoặc cần CodeX chạy SQL/Supabase action.
