# C6.5B - Hidden route skeleton + owner guard

C6.5B STATUS: HIDDEN ROUTE SKELETON OWNER GUARD
C6_5A_STATUS: PASS
HIDDEN_ROUTE_IMPLEMENTED: YES
HIDDEN_ROUTE: #/internal/centers
OWNER_GUARD_IMPLEMENTED: YES
OWNER_ONLY_ACCESS_IMPLEMENTED: YES
SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO
CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO
INTERNAL_CENTER_CONSOLE_SKELETON_IMPLEMENTED: YES
CENTERS_LIST_QUERY_IMPLEMENTED: NO
CENTERS_LIST_READONLY_IMPLEMENTED: NO
ADD_CENTER_IMPLEMENTED: NO
ACTING_MODE_IMPLEMENTED: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
NEW_CENTER_CREATED: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
RUNTIME_CHANGE: YES
RUNTIME_CHANGE_SCOPE: HIDDEN_ROUTE_SKELETON_OWNER_GUARD_ONLY
C6_5C_STARTED: NO
C6_6_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.5B

C6.5B tạo hidden route skeleton `#/internal/centers` và owner guard tối thiểu cho Internal Center Console. Owner có thể mở route thủ công để thấy màn hình placeholder/readiness. Signed-out và non-owner không được thấy nội dung console.

Phase này không làm centers list thật, không SQL, không Supabase action, không tạo center/user/membership, không nút `Thêm cơ sở`, không acting mode, không mở C7 và không commit/push.

## 2. Trạng thái sau C6.5A

C6.5A đã PASS và đã chốt thiết kế:

- hidden route proposal: `#/internal/centers`;
- owner-only guard: signed-in + active membership + role `owner`;
- `center_admin` access: NO;
- signed-out access: NO;
- centers list readonly: designed nhưng chưa implement;
- Add center defer C6.6;
- acting mode defer C7.4.

Nền C6.4 vẫn giữ manual QA owner login PASS cho `owner.duchai@ichess.vn`, role `owner`, center `dreamhome_prod`, membership `active`.

## 3. Runtime changes summary

Runtime changes:

- `src/main.js`: thêm hằng route `#/internal/centers`, helper kiểm route hash, owner guard, renderer skeleton, renderer access denied, handler quay lại dashboard và listener `hashchange`.
- `src/styles.css`: thêm style tối thiểu cho màn hình Internal Center Console skeleton.

Không có router refactor lớn. Dashboard mặc định vẫn chạy như cũ khi không ở route `#/internal/centers`.

## 4. Hidden route implemented

Hidden route đã implement: `#/internal/centers`.

Route này không xuất hiện trong taskbar/sidebar/navigation customer-facing. C6.5B test bằng cách gõ URL/hash thủ công:

`http://localhost:5173/ichess-center-os/#/internal/centers`

URL chỉ là entry point. Bảo vệ thật nằm ở owner guard runtime.

## 5. Owner guard implemented

Owner guard yêu cầu:

1. `cloudStatus.authStatus === signed-in`;
2. có user hiện tại;
3. center binding đã `bound`;
4. membership hiện tại có `status = active`;
5. role normalize về `owner`.

Chỉ khi đủ các điều kiện trên, app mới render Internal Center Console skeleton.

## 6. Signed-out behavior

Signed-out mở `#/internal/centers` sẽ thấy login gate hiện có của app, không render Internal Center Console. Không leak danh sách centers, không fallback staging, không tự đăng nhập.

## 7. Non-owner behavior

Non-owner, bao gồm `center_admin`, `teacher`, `consultant`, `viewer`, không thấy skeleton. Runtime render thông báo:

`Bạn không có quyền truy cập khu vực nội bộ.`

Màn hình access denied chỉ hiển thị trạng thái đăng nhập và role hiện tại, không query hoặc render dữ liệu centers.

## 8. Owner skeleton behavior

Owner thấy màn hình placeholder:

- `Quản trị nội bộ`;
- `Danh sách cơ sở`;
- thông báo C6.5B mới tạo khung và kiểm tra quyền truy cập;
- ghi rõ danh sách cơ sở readonly sẽ làm ở C6.5C;
- context an toàn: tài khoản, vai trò, cơ sở hiện tại, mã cơ sở hiện tại.

Skeleton không query centers list thật.

## 9. Vì sao chưa query centers list

Centers list thật thuộc C6.5C. C6.5B chỉ chứng minh route và guard hoạt động trước khi đọc metadata centers.

Không query list sớm để tránh:

- RLS chưa rõ cho owner read-all centers;
- lẫn `dreamhome` staging vào production owner view;
- biến route skeleton thành console thật trước khi có test C6.5C;
- mở nhầm provisioning hoặc detail state.

## 10. Vì sao chưa có nút Thêm cơ sở

`Thêm cơ sở` là provisioning flow có rủi ro cao, có thể cần SQL/template/membership/Auth readiness. C6.5B không tạo nút này.

Add center tiếp tục defer C6.6.

## 11. Vì sao chưa acting mode

Acting mode là quyền nhạy cảm vì có thể chuyển từ đọc metadata sang thao tác hộ trong center khác. C6.5B không tạo acting mode và không "biến thành admin cơ sở".

Acting mode tiếp tục defer C7.4.

## 12. Manual QA checklist

Owner:

1. Login `owner.duchai@ichess.vn`.
2. Mở `#/internal/centers`.
3. Expected: thấy Internal Center Console skeleton.
4. Expected: role `owner` hiển thị đúng nếu có.
5. Expected: chưa có danh sách centers thật là đúng trong C6.5B.
6. Expected: chưa có nút `Thêm cơ sở`.

center_admin:

1. Login `admin.dreamhome@ichess.vn`.
2. Mở `#/internal/centers`.
3. Expected: bị chặn hoặc access denied.
4. Expected: không thấy nội dung internal console.

Signed-out:

1. Logout/incognito.
2. Mở `#/internal/centers`.
3. Expected: login gate hoặc không render internal console.

Dashboard:

1. Mở route mặc định `/ichess-center-os/`.
2. Expected: dashboard app vẫn hoạt động như trước.

## 13. Risk list

Risks còn lại:

- cần manual QA để xác nhận `owner.duchai@ichess.vn` thấy skeleton trên browser thật;
- cần manual QA để xác nhận `admin.dreamhome@ichess.vn` bị chặn;
- C6.5C phải kiểm RLS trước khi đọc centers list thật;
- route hidden không phải security, owner guard mới là security;
- nếu role/membership chưa resolve xong, route sẽ chưa render skeleton cho đến khi auth sync xong.

## 14. C6.5C dependency

C6.5C chỉ nên bắt đầu sau khi manual QA C6.5B PASS.

C6.5C scope dự kiến: readonly centers list với default filter `environment = production`, `status = active`. Nếu RLS không cho owner đọc list an toàn, C6.5C phải dừng NEEDS REVIEW.

## 15. C6.6 deferred

C6.6 mới xử lý Add center/provisioning nếu được duyệt. C6.5B không tạo center mới, không tạo Gò Vấp, không tạo Quận 12, không tạo membership.

## 16. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- global permission system;
- permission override;
- acting/support mode;
- Teacher Portal;
- Super Admin advanced.

## 17. PASS / NEEDS REVIEW criteria

PASS nếu:

- route `#/internal/centers` render được trong runtime;
- owner guard chỉ cho role `owner` + active membership;
- signed-out không thấy console;
- `center_admin` không thấy console;
- owner thấy skeleton;
- dashboard mặc định không vỡ;
- không query centers list thật;
- không có nút `Thêm cơ sở`;
- không acting mode;
- không SQL/Supabase action;
- không tạo Auth user/membership/center;
- không xóa/migrate Angel Wings;
- all C6 smokes pass;
- `npm run build` pass;
- `git diff --check` pass;
- không commit/push.

NEEDS REVIEW nếu:

- phải refactor router lớn;
- không xác định được owner guard an toàn;
- centers list/RLS cần SQL ngay;
- owner route render lẫn staging data;
- non-owner thấy được skeleton;
- xuất hiện Add center hoặc acting mode;
- có file ngoài scope.

