# C6.4C - Owner membership apply decision READY

C6.4C STATUS: OWNER MEMBERSHIP APPLY DECISION READY
C6_4A_STATUS: PASS
C6_4B_STATUS: PASS
APPLY_DECISION_REVIEWED: YES
CURRENT_APPLY_DECISION: READY TO APPLY IN C6.4D
READY_TO_APPLY: YES
NOT_READY_TO_APPLY: NO
BLOCKED: NO
OWNER_EMAIL_CONFIRMED: YES
OWNER_EMAIL: owner.duchai@ichess.vn
OWNER_AUTH_USER_ID_CONFIRMED: YES
OWNER_AUTH_USER_ID: 9683b2c8-3970-4eac-99b3-985d503bdeb9
TARGET_CENTER_CONFIRMED: YES
TARGET_CENTER_ID: dreamhome_prod
TARGET_ROLE: owner
TARGET_MEMBERSHIP_STATUS: active
SUPABASE_PROJECT_CONFIRMED_FOR_APPLY: USER_SUPABASE_PROJECT
BACKUP_RISK_CONFIRMED_FOR_APPLY: LIGHTWEIGHT_MEMBERSHIP_ONLY
OWNER_AUTH_USER_CREATED_BEFORE_C6_4C: YES
OWNER_AUTH_USER_CREATED_BY_CODEX: NO
OWNER_MEMBERSHIP_CREATED: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
WILDCARD_CENTER_ID_RECOMMENDED: NO
NEW_CENTER_CREATED: NO
RUNTIME_CHANGE: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.4C

C6.4C là decision checkpoint trước khi apply owner membership thật. Phase này ghi nhận trạng thái READY TO APPLY cho C6.4D, dựa trên C6.4A/C6.4B PASS và thông tin owner test account do user cung cấp.

C6.4C không chạy SQL, không gọi Supabase action, không tạo/sửa Auth user, không tạo membership thật, không sửa runtime, không mở C6.5/C7 và không commit/push.

## 2. Trạng thái sau C6.4B

C6.4B đã tạo provisioning pack:

- `docs/supabase-c6-4b-owner-membership-readiness-provisioning-pack.md`
- `docs/supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql`
- `docs/supabase-c6-4b-manual-apply-owner-membership-template.sql`
- `tests/supabase-c6-4b-owner-membership-readiness-provisioning-pack-smoke.js`

Provisioning pack đã chuẩn bị checklist, read-only SQL và manual apply template cho phase sau. C6.4B không apply SQL và không tạo membership.

## 3. C6.4A role boundary recap

C6.4A đã chốt:

- `owner` đọc metadata danh sách cơ sở.
- `owner` không mặc định sửa dữ liệu center.
- `center_admin` vào và thao tác trong center được gán.
- `viewer` optional/read-only.
- Ngắn hạn dùng membership per center.
- Dài hạn global role/permission defer C7.
- Không dùng wildcard `center_id`.
- Acting mode defer C7.4.

## 4. C6.4B provisioning pack recap

C6.4B đã chuẩn bị hướng apply owner membership theo mô hình membership per center/hybrid:

- inspect `centers`, `center_members`, roles và helper functions;
- dùng placeholder `OWNER_USER_ID_HERE`;
- dùng placeholder `TARGET_CENTER_ID_HERE`;
- apply block trong template đang comment;
- template mặc định `rollback;`;
- không hardcode user thật trong template C6.4B.

## 5. Owner test account đã được user tạo

User đã tạo Auth user test owner riêng:

- owner email: `owner.duchai@ichess.vn`
- owner user_id: `9683b2c8-3970-4eac-99b3-985d503bdeb9`

Auth user này được tạo trước C6.4C bởi user. CodeX không tạo Auth user và không gọi Supabase.

## 6. Target membership dự kiến

Target membership dự kiến cho C6.4D:

- owner email: `owner.duchai@ichess.vn`
- owner user_id: `9683b2c8-3970-4eac-99b3-985d503bdeb9`
- target center_id: `dreamhome_prod`
- target role: `owner`
- target membership status: `active`

Không dùng wildcard `center_id`.

## 7. Apply decision model

Decision model:

- READY nếu owner email, owner UID, target center, target role và target status đã được user cung cấp.
- READY không có nghĩa là CodeX đã verify live Supabase trong C6.4C.
- Live read-only precheck vẫn thuộc C6.4D trước khi apply thật.
- Apply thật phải dùng phase riêng và có xác nhận rõ.

## 8. Current decision: READY TO APPLY IN C6.4D

CURRENT_APPLY_DECISION: READY TO APPLY IN C6.4D.

Lý do đủ điều kiện decision:

- Owner email đã có: `owner.duchai@ichess.vn`.
- Auth user id đã có: `9683b2c8-3970-4eac-99b3-985d503bdeb9`.
- Target center đã có: `dreamhome_prod`.
- Target role đã có: `owner`.
- Target status đã có: `active`.
- Không dùng wildcard `center_id`.
- Apply thật được tách sang C6.4D.

## 9. Vì sao chưa apply trong C6.4C

C6.4C không apply vì đây là decision checkpoint. Phase này không chạy SQL, không gọi Supabase action và không sửa database/Auth/membership.

Apply thật cần C6.4D để:

- chạy read-only precheck trong Supabase;
- xác nhận UID/email khớp;
- xác nhận `dreamhome_prod` tồn tại, `environment = production`, `status = active`;
- xác nhận membership hiện tại chưa có hoặc đúng expectation;
- quyết định apply template sau precheck.

## 10. Read-only precheck bắt buộc trước C6.4D

Final precheck before C6.4D vẫn phải chạy read-only SQL trong Supabase để xác nhận:

- Auth user tồn tại.
- UID/email khớp.
- Membership hiện tại chưa có hoặc đúng expectation.
- `dreamhome_prod` tồn tại, environment `production`, status `active`.

Thiếu live result trong C6.4C không phải blocker vì C6.4C chỉ là docs/test decision phase.

## 11. SQL safety reminder

C6.4D phải bắt đầu bằng read-only inspect SQL từ C6.4B. Chỉ khi precheck PASS mới xem xét manual apply template.

Safety:

- không apply nếu UID/email không khớp;
- không apply nếu target center không phải `dreamhome_prod`;
- không apply nếu center không active/production;
- không apply nếu SQL template chưa được review;
- không apply nếu chưa xác nhận backup/lightweight risk.

## 12. Vì sao không dùng wildcard center_id

Không dùng `center_id = '*'` vì owner membership trong C6 là membership per center. Wildcard làm mờ boundary quyền, khó audit và có thể phá RLS/helper.

Nếu cần global owner role thật, thiết kế đó defer C7 bằng schema/permission system riêng.

## 13. Vì sao dùng test owner account riêng thay vì `tranduchai@gmail.com`

Dùng `owner.duchai@ichess.vn` vì đây là test owner account mới, sạch hơn tài khoản `tranduchai@gmail.com` từng dính staging. Việc tách tài khoản giúp kiểm C6.5 Internal Center Console sau này rõ hơn và giảm nguy cơ lẫn dữ liệu/role cũ.

## 14. Điều kiện để sang C6.4D apply thật

Điều kiện:

- C6.4C PASS.
- User xác nhận sang C6.4D apply phase.
- C6.4D chạy read-only precheck trước.
- Precheck xác nhận Auth user tồn tại và UID/email khớp.
- Precheck xác nhận `dreamhome_prod` production active.
- Precheck xác nhận membership hiện tại an toàn để apply.
- Manual apply template được review lần cuối.

## 15. Manual QA sau C6.4D

Manual QA dự kiến sau C6.4D:

- Login `owner.duchai@ichess.vn`.
- App không được lẫn staging Angel Wings nếu membership chỉ là `dreamhome_prod`.
- Nếu runtime hiện chưa có owner-specific UI, ghi nhận behavior hiện tại.
- Không kỳ vọng Internal Center Console trong C6.4D.
- Không kỳ vọng owner center list UI trước C6.5.
- Xác nhận `admin.dreamhome@ichess.vn` vẫn vào `dreamhome_prod` bình thường.

## 16. C6.5 dependency

C6.5 Internal Center Console phụ thuộc owner membership đã apply/verify xong. C6.4C không tạo route `/internal/centers`, không tạo nút `Thêm cơ sở` và không tạo UI danh sách center.

## 17. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- global role/permission system;
- permission override;
- acting/support mode;
- Teacher Portal;
- Super Admin/customer-facing concept.

## 18. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/test đầy đủ;
- C6.4A/C6.4B được review;
- current decision là READY TO APPLY IN C6.4D;
- owner email/user_id/target center được ghi đúng;
- CodeX không tạo Auth user;
- không tạo membership;
- không chạy SQL;
- không Supabase action;
- không runtime change;
- không tạo center mới;
- không mở C6.5/C7;
- all C6 smokes pass;
- `npm run build` pass;
- `git diff --check` pass;
- không commit/push.

NEEDS REVIEW nếu thiếu target identity, phát hiện cần apply ngay trong C6.4C, có file ngoài scope, hoặc phát hiện runtime/C6.5/C7 thay đổi.
