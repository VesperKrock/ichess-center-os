# C6.5D - Checkpoint review Internal Center Console

C6.5D STATUS: CHECKPOINT REVIEW INTERNAL CENTER CONSOLE
C6_5A_STATUS: PASS
C6_5B_STATUS: PASS
C6_5C_STATUS: PASS
C6_5B_MANUAL_QA: PASS
C6_5C_MANUAL_QA: PASS
INTERNAL_CENTER_CONSOLE_AVAILABLE: YES
HIDDEN_ROUTE: #/internal/centers
OWNER_GUARD_ACTIVE: YES
OWNER_ONLY_ACCESS: YES
CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO
SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO
CENTERS_LIST_READONLY_AVAILABLE: YES
CENTERS_LIST_DEFAULT_FILTER_ENVIRONMENT: production
CENTERS_LIST_DEFAULT_FILTER_STATUS: active
DREAMHOME_PROD_VISIBLE: YES
STAGING_DREAMHOME_VISIBLE_IN_DEFAULT_LIST: NO
ADD_CENTER_IMPLEMENTED: NO
ADD_CENTER_DEFERRED_TO_C6_6: YES
ADD_CENTER_UX_ONE_VISIBLE_REQUIRED_FIELD_DESIGNED: YES
ADD_CENTER_VISIBLE_REQUIRED_FIELD: Tên cơ sở
ACTING_MODE_IMPLEMENTED: NO
ACTING_MODE_DEFERRED_TO_C7_4: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
NEW_CENTER_CREATED: NO
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
RUNTIME_CHANGE_NEW_IN_C6_5D: NO
C6_6_STARTED: NO
C7_STARTED: NO
READY_FOR_C6_5E_COMMIT_PUSH: YES
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.5D

C6.5D là checkpoint review cho Internal Center Console sau khi C6.5A, C6.5B và C6.5C đã PASS. Phase này chỉ tổng hợp, ghi nhận manual QA và chuẩn bị sang C6.5E commit/push.

C6.5D không thêm logic runtime mới, không chạy SQL, không gọi Supabase ngoài app, không tạo center/user/membership, không tạo nút Thêm cơ sở, không acting mode và không mở C7.

## 2. Trạng thái trước checkpoint

Trước checkpoint:

- C6.5A: PASS.
- C6.5B: PASS.
- C6.5C: PASS.
- Manual QA C6.5B: PASS.
- Manual QA C6.5C: PASS.
- Latest commit trước C6.5 vẫn là `7636235 C6.4 owner role binding checkpoint`.
- C6.5 hiện chưa commit/push.

## 3. Tổng hợp C6.5A

C6.5A đã chốt thiết kế Internal Center Console:

- hidden route `#/internal/centers`;
- owner-only guard;
- signed-out không được vào;
- `center_admin` không được vào;
- centers list readonly;
- default filter `environment=production`, `status=active`;
- Add center defer C6.6;
- acting mode defer C7.4.

## 4. Tổng hợp C6.5B

C6.5B đã implement runtime tối thiểu:

- hidden route `#/internal/centers`;
- owner guard dựa trên signed-in user, center binding, active membership và role `owner`;
- access denied an toàn cho non-owner;
- signed-out không thấy Internal Center Console;
- skeleton/placeholder cho khu vực Quản trị nội bộ.

Không có centers list thật trong C6.5B, không có Add center, không acting mode.

## 5. Tổng hợp C6.5C

C6.5C đã implement centers list readonly:

- query readonly từ `public.centers`;
- fields `id,name,slug,environment,status,created_at,updated_at`;
- filter mặc định `environment=production`, `status=active`;
- loading state;
- empty state;
- error state;
- table/list readonly;
- không có Add center;
- không có acting mode;
- không có edit center.

## 6. Manual QA C6.5B PASS

Manual QA C6.5B: PASS.

Owner:

- account `owner.duchai@ichess.vn`;
- route `#/internal/centers`;
- vào được Internal Center Console;
- thấy khu vực Quản trị nội bộ / Danh sách cơ sở;
- role `owner`;
- cơ sở hiện tại DreamHome;
- center id `dreamhome_prod`.

`center_admin`:

- account `admin.dreamhome@ichess.vn`;
- bị chặn khỏi Internal Center Console;
- thấy trạng thái không có quyền truy cập;
- role `center_admin`.

Signed-out:

- không thấy internal console;
- không truy cập được nội dung owner-only.

## 7. Manual QA C6.5C PASS

Manual QA C6.5C: PASS
Owner account: owner.duchai@ichess.vn
Route: #/internal/centers
Visible center: DreamHome
Visible center_id: dreamhome_prod
Visible slug: dreamhome
Visible environment: production
Visible status: active
Staging dreamhome visible by default: NO
Add center button visible: NO
Acting mode visible: NO

Kết quả quan trọng: owner xem được list readonly `DreamHome / dreamhome_prod / production / active`, còn staging `dreamhome` bị ẩn trong default list.

## 8. Internal Center Console hiện tại

Internal Center Console hiện tại là hidden route `#/internal/centers`. Đây là khu vực nội bộ dành cho owner để xem danh sách cơ sở production active theo dạng readonly.

Route này chưa được đưa vào navigation công khai, chưa có provisioning flow, chưa có center detail edit và chưa có acting mode.

## 9. Owner guard hiện tại

Owner guard hiện tại yêu cầu:

- user đã signed-in;
- center binding đã resolve;
- membership hiện tại `status=active`;
- role normalize về `owner`.

`center_admin` và signed-out không có quyền truy cập Internal Center Console.

## 10. Centers list readonly hiện tại

Centers list hiện tại chỉ đọc từ `public.centers` với fields:

```txt
id,name,slug,environment,status,created_at,updated_at
```

Filter mặc định:

```txt
environment=production
status=active
```

UI chỉ hiển thị dữ liệu, không có insert/update/upsert/delete, không có nút chỉnh sửa, không mở detail edit.

## 11. Production/staging behavior

Behavior hiện tại:

- `dreamhome_prod` là DreamHome production center.
- `dreamhome` là staging/test sandbox.
- Default list trong Internal Center Console chỉ hiển thị `production` và `active`.
- Vì vậy owner thấy DreamHome production, không thấy staging trong list mặc định.

## 12. Vì sao dreamhome staging không hiện mặc định

Staging `dreamhome` không hiện mặc định vì query C6.5C lọc `environment=production` và `status=active`. Đây là guard chủ động để tránh owner nhìn nhầm staging/test sandbox là cơ sở production.

Nếu sau này cần xem staging, việc đó phải là một mode/filter nội bộ rõ ràng, không phải mặc định C6.5.

## 13. Vì sao chưa có Add center

Add center là provisioning flow có tác động dữ liệu. Nó có thể cần tạo row `centers`, sinh slug, sinh `center_id`, gán membership, kiểm duplicate, audit, rollback và policy review.

C6.5D không implement Add center. C6.6 mới làm Add center provisioning flow.

## 14. UX định hướng cho Add center C6.6

C6.6 định hướng:

- Anh Hải chỉ cần nhập Tên cơ sở.
- Hệ thống tự sinh slug.
- Hệ thống tự sinh center_id dạng `<slug>_prod`.
- Hệ thống đặt `environment=production`.
- Hệ thống đặt `status=active`.
- Hệ thống tạo "ngôi nhà trống".
- Owner membership cho owner hiện tại cần được tạo/đảm bảo theo checklist.
- Nếu slug/id trùng, UI phải báo rõ và gợi ý tên/mã khác.

C6.5D chỉ ghi định hướng UX này, chưa implement.

## 15. Vì sao chưa có acting mode

Acting mode là quyền nhạy cảm vì có thể khiến owner thao tác như admin cơ sở. Nó cần audit, guard, UI rõ ràng, khả năng thoát mode, và quy tắc dữ liệu riêng.

C6.5D không implement acting mode. Acting mode defer C7.4.

## 16. Files changed summary

Docs:

- `docs/supabase-c6-5a-internal-center-console-audit-design.md`
- `docs/supabase-c6-5b-hidden-route-skeleton-owner-guard.md`
- `docs/supabase-c6-5c-centers-list-readonly.md`
- `docs/supabase-c6-5d-checkpoint-review-internal-center-console.md`

Tests:

- `tests/supabase-c6-5a-internal-center-console-audit-design-smoke.js`
- `tests/supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js`
- `tests/supabase-c6-5c-centers-list-readonly-smoke.js`
- `tests/supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js`
- các C6 smoke cũ được cập nhật allowlist checkpoint C6.5.

Runtime từ C6.5B/C:

- `src/main.js`
- `src/styles.css`

Runtime mới trong C6.5D: không có.

SQL: không có.

## 17. Risk list

Các rủi ro còn lại:

- RLS/policy thực tế phải tiếp tục cho owner đọc `public.centers` phù hợp.
- C6.6 provisioning cần thiết kế duplicate slug/id và rollback.
- Acting mode chưa có và không được mở lẫn vào C6.5.
- Route hidden vẫn là internal route, chưa phải UI công khai.

Không có blocker cho checkpoint C6.5D nếu smoke/build/diff đều PASS.

## 18. C6.6 dependency

C6.6 chỉ nên bắt đầu sau C6.5E commit/push. C6.6 là phase Add center provisioning flow riêng, cần checklist SQL/policy/runtime và manual QA riêng.

## 19. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- permission override;
- Teacher Portal;
- Super Admin advanced;
- acting mode C7.4.

Không có nội dung C7 nào được implement trong C6.5D.

## 20. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/test checkpoint đầy đủ;
- C6.5A/B/C đều được tổng hợp;
- manual QA C6.5B/C được ghi PASS;
- owner xem được list readonly;
- `DreamHome / dreamhome_prod / production / active` visible;
- staging `dreamhome` hidden mặc định;
- `center_admin` và signed-out vẫn bị chặn;
- không Add center;
- không acting mode;
- không SQL/Supabase action;
- không tạo Auth user/membership/center;
- không runtime change mới trong C6.5D;
- all C6 smokes PASS;
- `npm run build` PASS;
- `git diff --check` PASS;
- không commit/push.

NEEDS REVIEW nếu có file ngoài scope, runtime mới ngoài yêu cầu, SQL/Supabase action, Add center/acting mode xuất hiện, hoặc smoke/build/diff fail.

## 21. Recommendation sang C6.5E commit/push

Recommendation: nếu C6.5D verification PASS, sang C6.5E để commit/push checkpoint Internal Center Console.

Sau C6.5E, có thể mở C6.6 Add center provisioning flow theo thiết kế một trường bắt buộc là Tên cơ sở, với guard/policy/checklist riêng.
