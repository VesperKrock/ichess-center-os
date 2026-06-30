# C6.5A - Internal Center Console audit/design

C6.5A STATUS: INTERNAL CENTER CONSOLE AUDIT DESIGN
C6_4_DONE: YES
OWNER_LOGIN_MANUAL_QA_PASS: YES
INTERNAL_CENTER_CONSOLE_DESIGNED: YES
HIDDEN_ROUTE_DESIGNED: YES
HIDDEN_ROUTE_PROPOSAL: #/internal/centers
OWNER_GUARD_DESIGNED: YES
OWNER_ONLY_ACCESS_DESIGNED: YES
CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO
SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO
CENTERS_LIST_READONLY_DESIGNED: YES
CENTERS_LIST_DEFAULT_FILTER_ENVIRONMENT: production
CENTERS_LIST_DEFAULT_FILTER_STATUS: active
ADD_CENTER_IMPLEMENTED: NO
ADD_CENTER_DEFERRED_TO_C6_6: YES
ACTING_MODE_IMPLEMENTED: NO
ACTING_MODE_DEFERRED_TO_C7_4: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
NEW_CENTER_CREATED: NO
RUNTIME_CHANGE: NO
C6_5B_STARTED: NO
C6_5C_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.5A

C6.5A là phase audit/design cho Internal Center Console sau khi C6.4 owner role binding đã DONE. Mục tiêu là chốt phạm vi an toàn để owner có thể xem danh sách cơ sở production/active trong một console nội bộ, chuẩn bị cho C6.5B/C.

Phase này chỉ tạo tài liệu và smoke test. Không sửa runtime, không tạo route thật, không chạy SQL, không gọi Supabase, không tạo center mới, không tạo/sửa Auth user hoặc membership, không commit/push.

## 2. Trạng thái sau C6.4

Trạng thái nền:

- C6.4A/B/C/D/E/F đã PASS.
- Owner test `owner.duchai@ichess.vn` đã có membership `dreamhome_prod`.
- User ID: `9683b2c8-3970-4eac-99b3-985d503bdeb9`.
- Role: `owner`.
- Membership status: `active`.
- Center: `dreamhome_prod`.
- Center environment: `production`.
- Manual QA owner login: PASS.
- Owner login vào dữ liệu Cloud, không lẫn staging/Angel Wings, không có badge đỏ `3`.

## 3. Internal Center Console là gì

Internal Center Console là một màn hình nội bộ dành cho owner để xem metadata danh sách cơ sở. Console này không thay thế app vận hành center hiện tại.

Phạm vi thiết kế tối thiểu:

- owner xem danh sách center từ bảng `centers`;
- mặc định chỉ hiển thị `environment = production`;
- mặc định chỉ hiển thị `status = active`;
- danh sách chỉ đọc;
- không tự đổi center vận hành hiện tại;
- không ghi localStorage nghiệp vụ;
- không chạy provisioning;
- không seed/migrate/clear dữ liệu.

## 4. Internal Center Console không phải gì

Internal Center Console trong C6.5A không phải:

- Super Admin customer-facing UI;
- account management UI;
- permission override UI;
- acting/support mode;
- route công khai trong navigation;
- nơi tạo cơ sở mới;
- nơi tạo Auth user hoặc membership;
- dashboard vận hành lớp/học phí/kho hàng;
- công cụ migrate staging sang production;
- công cụ sửa dữ liệu production.

## 5. Actor/role được phép vào

Actor được thiết kế cho C6.5:

- `owner`: được phép vào Internal Center Console nếu đang signed-in và có active membership phù hợp.
- `center_admin`: không được phép vào Internal Center Console.
- `teacher`, `consultant`, `viewer`: không được phép vào.
- signed-out user: không được phép vào.

`qtv`/legacy admin-style role không được mở thêm trong C6.5A. Nếu cần hỗ trợ role nội bộ khác, phải có phase riêng sau khi owner-only path ổn định.

## 6. Hidden route proposal

Route đề xuất: `#/internal/centers`.

Route này là hidden route, không hiện trên taskbar/sidebar/navigation customer-facing. Tính "hidden" chỉ giảm nhầm lẫn UX, không phải bảo mật. Bảo mật phải nằm ở owner guard và RLS Supabase.

C6.5A chỉ thiết kế route. Không route UI thật, không router change, không button mở console.

## 7. Owner guard proposal

Owner guard tối thiểu cho C6.5B:

1. User phải signed-in bằng Supabase Auth.
2. Runtime phải resolve được active membership.
3. Membership role phải là `owner`.
4. Membership status phải là `active`.
5. Nếu guard fail, hiển thị trạng thái access denied hoặc điều hướng về app hiện tại.
6. Guard không được fallback sang staging `dreamhome`.
7. Guard không được tự tạo membership hoặc center.

Guard cần dùng nguồn runtime hiện có sau C6.4: account-based center resolver và role normalization. Không mở logic account advanced/C7.

## 8. Centers list readonly design

Centers list trong C6.5C là readonly list từ `public.centers`.

Query/read model dự kiến:

- đọc danh sách centers mà owner được phép thấy;
- mặc định filter `environment = production`;
- mặc định filter `status = active`;
- sort ổn định theo `name` hoặc `created_at`;
- không upsert/update/delete;
- không gọi provisioning template;
- không tạo `center_members`.

Nếu RLS hiện tại chưa cho owner đọc danh sách centers phù hợp, C6.5B/C phải dừng và báo NEEDS REVIEW thay vì bypass bằng runtime hack.

## 9. Default filter production/active

Default filter:

- `environment = production`;
- `status = active`.

Không hiển thị staging `dreamhome` trong default list để tránh owner nhầm staging Angel Wings với production thật. Staging/test centers chỉ nên xuất hiện nếu có future internal toggle rõ ràng, không nằm trong C6.5A.

## 10. Data fields dự kiến

Fields dự kiến cho readonly list:

- `id`;
- `name`;
- `slug`;
- `environment`;
- `status`;
- `created_at`;
- `updated_at`.

Fields hiển thị nên ưu tiên dễ đọc:

- Tên cơ sở: `name`.
- Mã cơ sở: `id`.
- Slug: `slug`.
- Môi trường: `environment`.
- Trạng thái: `status`.
- Cập nhật lần cuối: `updated_at`.

Không hiển thị dữ liệu học viên, học phí, lịch học, kho hàng hoặc doanh thu trong console C6.5.

## 11. Empty/loading/error states

Loading state:

- hiển thị trạng thái đang tải danh sách cơ sở;
- không render dữ liệu cũ từ localStorage.

Empty state:

- nếu không có center production/active, hiển thị thông báo nội bộ ngắn;
- không hiện nút `Thêm cơ sở` trong C6.5.

Error state:

- nếu RLS/network/read error, hiển thị lỗi readonly;
- không retry ghi dữ liệu;
- không fallback sang `.dreamhome`;
- không tự seed center.

Access denied state:

- signed-out, `center_admin`, `viewer`, `teacher`, `consultant` đều bị chặn;
- không tiết lộ dữ liệu centers.

## 12. LocalStorage/cache considerations

Internal Center Console không nên dùng localStorage nghiệp vụ làm source of truth.

Nguyên tắc:

- không đọc `ichessCenterOS.students.dreamhome`;
- không đọc `ichessCenterOS.students.dreamhome_prod`;
- không đọc cache học phí/kho hàng/lịch học để dựng danh sách centers;
- không mutate `.dreamhome` hoặc `.dreamhome_prod`;
- không đổi active operational center khi owner chỉ xem list;
- nếu cần cache UI tạm thời, cache đó phải là metadata-only và center-aware.

Console phải tránh mọi đường dẫn có thể làm dữ liệu staging hiện lên trong context production.

## 13. Production/staging separation

Convention hiện tại:

- `dreamhome` = staging/test sandbox.
- `dreamhome_prod` = DreamHome production empty center.

C6.5 list mặc định production/active để owner nhìn thấy `dreamhome_prod`, không lẫn `dreamhome` staging. Console không migrate, seed, clear hoặc clone dữ liệu giữa hai center.

Nếu future centers như `govap_prod` hoặc `quan12_prod` được tạo sau này, chúng cũng phải đi qua provisioning phase riêng, không tạo trong C6.5A.

## 14. Vì sao chưa làm Add center

`Add center` chưa làm vì đây là nghiệp vụ provisioning có rủi ro cao:

- cần tạo row `centers`;
- cần tạo membership admin/owner;
- cần xác định slug/environment/status;
- cần kiểm tra RLS/constraints;
- cần rollback plan;
- có thể cần Auth user readiness.

Do đó `Add center` được defer sang C6.6. C6.5 chỉ chuẩn bị console readonly.

## 15. Vì sao chưa làm acting mode

Acting mode chưa làm vì đây là quyền nhạy cảm: owner hoặc support có thể "vào vai" cơ sở khác. Nếu làm sớm dễ lẫn quyền đọc metadata với quyền thao tác dữ liệu center.

Acting mode defer C7.4. C6.5 chỉ cho owner xem metadata danh sách cơ sở, không mở quyền thao tác hộ.

## 16. C6.5B/C/D roadmap

Roadmap đề xuất:

- C6.5B: hidden route skeleton `#/internal/centers` + owner guard, không list phức tạp.
- C6.5C: readonly centers list với default filter production/active.
- C6.5D: optional center detail readonly hoặc empty/detail state, vẫn không acting.
- C6.5E: checkpoint review C6.5.
- C6.5F: commit/push nếu smoke/build/manual QA pass.

C6.5B/C phải giữ `center_admin` không vào được Internal Center Console.

## 17. C6.6 Add center deferred

C6.6 mới xử lý thêm cơ sở trống nếu được duyệt.

Điều kiện trước C6.6:

- owner console readonly đã PASS;
- schema centers đã ổn;
- provisioning checklist đã rõ;
- SQL template được review;
- có quyết định tạo center cụ thể;
- có manual QA plan cho production/staging separation.

C6.5A không tạo `govap_prod`, `quan12_prod` hoặc bất kỳ center nào.

## 18. C7 deferred

C7 vẫn deferred:

- username login;
- account management UI;
- global permission system;
- permission override;
- acting/support mode;
- Teacher Portal;
- Super Admin customer-facing concept.

Các nội dung này không được đưa vào UI/customer-facing docs trong C6.5A.

## 19. Risk list

Risks cần kiểm soát trong C6.5B/C:

- route hidden bị hiểu nhầm là bảo mật;
- owner guard thiếu trạng thái signed-out/access denied;
- `center_admin` nhìn thấy internal console;
- list centers đọc nhầm staging `dreamhome`;
- UI dùng localStorage staging trước khi cloud read xong;
- nút `Thêm cơ sở` xuất hiện quá sớm;
- acting mode bị trộn vào list readonly;
- RLS chưa cho owner đọc centers list;
- console vô tình đổi center vận hành hiện tại;
- docs/customer-facing copy lộ roadmap C7.

## 20. PASS / NEEDS REVIEW criteria

PASS nếu:

- tài liệu C6.5A có đủ marker;
- thiết kế route ẩn `#/internal/centers` chỉ là proposal;
- owner-only guard được chốt;
- `center_admin` và signed-out access đều bị chặn;
- centers list readonly được thiết kế;
- default filter production/active được ghi rõ;
- `Add center` defer C6.6;
- acting mode defer C7.4;
- không runtime diff;
- không SQL/Supabase action;
- không tạo Auth user/membership/center;
- smoke C6.5A pass;
- full C6 smoke pass;
- `npm run build` pass;
- `git diff --check` pass;
- không commit/push.

NEEDS REVIEW nếu:

- phải sửa runtime để thiết kế đi qua;
- cần apply SQL/RLS mới ngay;
- thấy file `src/` bị đổi;
- thấy route UI thật hoặc nút `Thêm cơ sở`;
- không chặn được `center_admin` theo thiết kế;
- không xác định được cách đọc centers list readonly an toàn;
- phát hiện lẫn staging `dreamhome` vào production owner view.

