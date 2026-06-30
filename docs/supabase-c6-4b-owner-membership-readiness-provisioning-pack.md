# C6.4B - Owner membership readiness/provisioning pack

C6.4B STATUS: OWNER MEMBERSHIP READINESS PROVISIONING PACK
C6_4A_STATUS: PASS
OWNER_MEMBERSHIP_READINESS_PACK_CREATED: YES
READONLY_INSPECT_SQL_CREATED: YES
MANUAL_APPLY_TEMPLATE_CREATED: YES
OWNER_ROLE_READY_FOR_LATER_APPLY: YES
OWNER_AUTH_USER_CREATED: NO
OWNER_MEMBERSHIP_CREATED: NO
OWNER_USER_ID_SELECTED: NO
TARGET_CENTER_SELECTED_FOR_OWNER_APPLY: NO
WILDCARD_CENTER_ID_RECOMMENDED: NO
MEMBERSHIP_PER_CENTER_SHORT_TERM: YES
GLOBAL_ROLE_DEFERRED_TO_C7: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
NEW_CENTER_CREATED: NO
RUNTIME_CHANGE: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.4B

C6.4B chuẩn bị owner membership readiness/provisioning pack sau C6.4A PASS. Phase này chỉ tạo tài liệu, SQL inspect chỉ đọc, manual apply template cho phase sau và smoke test static.

C6.4B không tạo tài khoản anh Hải thật, không chọn `user_id` thật, không chọn target center để apply thật, không chạy SQL apply, không gọi Supabase action, không tạo membership, không sửa runtime, không mở C6.5/C7 và không commit/push.

## 2. Trạng thái sau C6.4A

C6.4A đã chốt role boundary tối thiểu:

- `owner`: đọc metadata danh sách cơ sở, không mặc định sửa dữ liệu center.
- `center_admin`: vào và thao tác trong center được gán.
- `viewer`: optional/read-only.
- Ngắn hạn dùng membership per center.
- Dài hạn global role/permission defer C7.
- Không dùng wildcard `center_id = '*'`.
- Acting mode defer C7.4.
- C6.5 Internal Center Console phụ thuộc boundary role từ C6.4.

Latest commit trước C6.4 là `8519155 C6.3 multi-center foundation checkpoint`; C6.4A hiện là phần thay đổi trong worktree trước C6.4B.

## 3. Role boundary đã chốt

Boundary:

- Đọc danh sách cơ sở = đọc metadata trong `public.centers`.
- Vào cơ sở = cần membership hoặc acting context cụ thể.
- Sửa dữ liệu vận hành = phải có quyền trong center cụ thể, không chỉ có quyền xem danh sách centers.

`owner` không được mặc định edit center data nếu chưa có acting context/audit rõ. `center_admin` chỉ thao tác trong center được gán, ví dụ `admin.dreamhome@ichess.vn` ở `dreamhome_prod`.

## 4. Vì sao C6.4B chưa tạo owner thật

C6.4B chưa tạo owner thật vì còn thiếu các xác nhận cần cho apply an toàn:

- email/tài khoản anh Hải chính xác;
- Auth user đã tồn tại;
- `auth.users.id` chính xác;
- target `center_id`;
- environment Supabase đúng;
- trạng thái target center;
- backup/export tối thiểu nếu cần;
- phase apply riêng được xác nhận.

Tạo nhầm owner membership là rủi ro quyền cao, nên C6.4B chỉ chuẩn bị checklist/template.

## 5. Owner membership readiness checklist

Trước khi apply thật ở phase sau, cần:

- Xác nhận email/tài khoản anh Hải sẽ dùng.
- Xác nhận Auth user đã tồn tại.
- Lấy đúng `auth.users.id`.
- Xác nhận target `center_id`.
- Xác nhận target center tồn tại và `status = active`.
- Xác nhận không dùng wildcard `center_id`.
- Xác nhận membership hiện tại chưa bị trùng.
- Xác nhận role sẽ là `owner`.
- Xác nhận apply ở Supabase project đúng môi trường.
- Backup/export tối thiểu nếu cần.

## 6. Read-only inspect SQL

File inspect:

`docs/supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql`

Mục tiêu:

- liệt kê centers hiện có;
- kiểm tra columns của `public.center_members`;
- xem distinct roles hiện có;
- đếm membership theo `center_id/role/status`;
- kiểm tra admin DreamHome hiện tại;
- chuẩn bị placeholder query để user thay email anh Hải nếu cần inspect `auth.users`;
- kiểm tra role `owner` hiện có chưa;
- kiểm tra helper functions `is_center_member` và `can_write_center` nếu có.

File này chỉ SELECT/read-only, không dùng để migration.

## 7. Manual apply template cho phase sau

File template:

`docs/supabase-c6-4b-manual-apply-owner-membership-template.sql`

Template này chỉ để review và chạy trong phase apply được xác nhận như C6.4C/C6.4D. C6.4B không chạy template.

Thiết kế:

- dùng placeholder `OWNER_USER_ID_HERE`;
- dùng placeholder `TARGET_CENTER_ID_HERE`;
- ví dụ target có thể là `dreamhome_prod`, nhưng không tự chọn thật;
- không hardcode email/user_id thật;
- không dùng wildcard `center_id`;
- apply block được comment;
- transaction kết thúc bằng `rollback;` mặc định.

Nếu `center_members` chưa có unique constraint `(user_id, center_id)`, phase sau cần quyết định thêm unique constraint hoặc dùng block kiểm tra tồn tại rồi insert/update. C6.4B không tự thêm constraint.

## 8. Điều kiện để apply thật ở C6.4C/C6.4D

Không apply nếu chưa có:

- email/user_id chính xác của anh Hải;
- target `center_id`;
- xác nhận environment;
- xác nhận SQL có phá dữ liệu hay không;
- xác nhận backup cần/không cần;
- xác nhận phase apply riêng.

Apply thật phải do phase sau quyết định rõ. C6.4B chỉ readiness/provisioning pack.

## 9. Vì sao không dùng wildcard center_id

Không dùng `center_id = '*'` trong `center_members`.

Lý do:

- membership per center cần trỏ tới center cụ thể;
- wildcard dễ phá RLS/helper;
- khó audit quyền vào dữ liệu vận hành;
- nếu cần global role thì thiết kế schema riêng ở C7, không nhét wildcard vào membership.

## 10. Membership per center trong C6

C6 dùng membership per center làm hướng ngắn hạn:

- owner muốn vào/hỗ trợ center nào thì có membership rõ cho center đó;
- `center_admin` chỉ có membership center được gán;
- không có quyền xuyên mọi center bằng URL;
- mỗi quyền vào center có `user_id`, `center_id`, `role`, `status`.

Đây là mô hình an toàn hơn trước khi có global permission đầy đủ.

## 11. Global role/permission defer C7

Global role/permission system defer C7:

- bảng global roles/profiles;
- permission override;
- acting/support mode;
- account management UI;
- chuẩn hóa `qtv`/`owner` nếu cần.

C6.4B không tạo schema global role.

## 12. Rủi ro khi gán owner sai

Rủi ro:

- gán nhầm `user_id` sẽ cấp quyền cao cho sai tài khoản;
- gán nhầm `center_id` làm owner vào sai cơ sở;
- dùng wildcard khiến quyền không audit được;
- update nhầm role của `center_admin` hiện có có thể ảnh hưởng vận hành DreamHome;
- apply sai Supabase project có thể làm lệch staging/production;
- thiếu backup khiến rollback thủ công khó hơn.

## 13. C6.5 Internal Center Console dependency

C6.5 cần provisioning pack này để biết:

- ai có thể vào route internal sau này;
- role `owner` được chuẩn bị ra sao;
- owner đọc centers metadata khác quyền vào center thế nào;
- khi nào cần membership per center;
- vì sao acting mode vẫn defer C7.4.

C6.4B không tạo route `/internal/centers`, không tạo nút `Thêm cơ sở` và không tạo UI.

## 14. Manual QA sau apply tương lai

Sau apply thật ở phase sau, manual QA nên kiểm:

1. Login bằng tài khoản owner đã xác nhận.
2. Xác nhận owner đọc được metadata centers theo scope phase đó.
3. Xác nhận owner không tự sửa dữ liệu center nếu chưa có acting context.
4. Xác nhận `center_admin` DreamHome vẫn vào `dreamhome_prod`.
5. Xác nhận `dreamhome` staging và `dreamhome_prod` production không lẫn dữ liệu.
6. Xác nhận không có badge đỏ `3` quay lại trong production empty.
7. Xác nhận không có center mới ngoài kế hoạch.

## 15. Files trong provisioning pack

Files C6.4B:

- `docs/supabase-c6-4b-owner-membership-readiness-provisioning-pack.md`
- `docs/supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql`
- `docs/supabase-c6-4b-manual-apply-owner-membership-template.sql`
- `tests/supabase-c6-4b-owner-membership-readiness-provisioning-pack-smoke.js`

Existing C6 smoke allowlists được cập nhật để nhận các file C6.4B. Runtime không đổi.

## 16. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/test/read-only SQL/manual apply template đầy đủ;
- provisioning pack owner membership rõ ràng;
- không chọn owner `user_id` thật;
- không chọn target center để apply thật;
- không tạo Auth user;
- không tạo membership;
- không chạy SQL apply;
- không Supabase action;
- không runtime change;
- không tạo center mới;
- không mở C6.5/C7;
- all C6 smokes pass;
- `npm run build` pass;
- `git diff --check` pass;
- không commit/push.

NEEDS REVIEW nếu phát hiện cần apply SQL ngay, cần tạo user/membership thật, có runtime blocker, hoặc có file ngoài scope.
