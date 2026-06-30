# C6.6A - Thêm cơ sở một trường audit/design

C6.6A STATUS: ADD CENTER ONE FIELD AUDIT DESIGN
C6_5_DONE: YES
ADD_CENTER_ONE_FIELD_UX_DESIGNED: YES
VISIBLE_REQUIRED_FIELD_COUNT: 1
VISIBLE_REQUIRED_FIELD: Tên cơ sở
AUTO_GENERATE_SLUG_DESIGNED: YES
AUTO_GENERATE_CENTER_ID_DESIGNED: YES
CENTER_ID_PATTERN_DESIGNED: <slug>_prod
DEFAULT_ENVIRONMENT_DESIGNED: production
DEFAULT_STATUS_DESIGNED: active
EMPTY_CENTER_DESIGNED: YES
CLONE_DREAMHOME: NO
CLONE_ANGEL_WINGS: NO
COPY_STAGING_STUDENTS: NO
OWNER_MEMBERSHIP_FOR_NEW_CENTER_DESIGNED: YES
CENTER_ADMIN_CREATION_REQUIRED_NOW: NO
CENTER_ADMIN_DEFERRED: YES
DUPLICATE_CONFLICT_HANDLING_DESIGNED: YES
FRONTEND_DIRECT_INSERT_RECOMMENDED: NO
GUARDED_RPC_OPTION_REVIEWED: YES
MANUAL_APPLY_OPTION_REVIEWED: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
AUTH_USER_CREATED: NO
MEMBERSHIP_CREATED: NO
NEW_CENTER_CREATED: NO
RUNTIME_CHANGE: NO
C6_6B_STARTED: NO
C6_6C_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.6A

C6.6A chỉ audit/design flow Thêm cơ sở cho owner/anh Hải sau khi C6.5 Internal Center Console đã DONE. Mục tiêu là chốt UX một trường, quy tắc sinh slug/center_id, checklist tạo "ngôi nhà trống", và hướng SQL/RPC cho phase sau.

C6.6A không sửa runtime, không chạy SQL, không gọi Supabase action, không tạo center thật, không tạo/sửa Auth user hoặc membership, không thêm nút Thêm cơ sở runtime, không mở C7 và không commit/push.

## 2. Trạng thái sau C6.5

C6.5 đã DONE:

- hidden route `#/internal/centers`;
- owner-only guard;
- `center_admin` và signed-out bị chặn;
- centers list readonly từ `public.centers`;
- filter mặc định `environment=production`, `status=active`;
- owner xem được `DreamHome / dreamhome_prod / production / active`;
- staging `dreamhome` bị ẩn mặc định.

Worktree trước C6.6A sạch, latest commit là `059d666 C6.5 internal center console checkpoint`.

## 3. UX một trường cho anh Hải

UX đề xuất: owner chỉ thấy một field bắt buộc là Tên cơ sở, sau đó hệ thống tự preview và tạo toàn bộ metadata cần thiết.

Ví dụ nhập:

- Gò Vấp;
- Quận 12;
- Phú Nhuận;
- Bình Thạnh.

Không bắt anh Hải nhập slug, `center_id`, `environment`, `status`, owner user id, SQL, membership hoặc thông tin kỹ thuật.

## 4. Field bắt buộc duy nhất: Tên cơ sở

Field bắt buộc duy nhất:

```txt
Tên cơ sở
```

Validation tối thiểu:

- trim khoảng trắng đầu/cuối;
- không cho chuỗi rỗng;
- không cho tên quá ngắn sau khi trim;
- không cho tên sinh ra slug rỗng;
- hiển thị lỗi dễ hiểu nếu trùng hoặc không hợp lệ.

## 5. Preview readonly tự sinh

Trước khi tạo, UI phase sau nên hiển thị preview readonly:

```txt
Tên cơ sở: Gò Vấp
Mã cơ sở sẽ tạo: govap_prod
Slug: govap
Môi trường: production
Trạng thái: active
```

Preview giúp owner biết hệ thống sắp tạo gì, nhưng không biến các field kỹ thuật thành input bắt buộc.

## 6. Slug generation design

Rule slug đề xuất:

- trim khoảng trắng đầu/cuối;
- lowercase;
- bỏ dấu tiếng Việt;
- chuyển `đ/Đ` thành `d`;
- loại ký tự không an toàn;
- collapse khoảng trắng/ký tự phân cách;
- bỏ ký tự phân cách đầu/cuối.

Audit C6.3/C6.5 cho thấy các ví dụ lịch sử đang dùng `govap_prod` và `quan12_prod`; để giữ tương thích với convention đã ghi trong docs trước đó, C6.6A khuyến nghị slug không dấu gạch ngang cho `center_id` phase đầu:

```txt
Gò Vấp -> govap
Quận 12 -> quan12
Phú Nhuận -> phunhuan
Bình Thạnh -> binhthanh
```

Ghi chú: slug có dấu gạch ngang như `go-vap` dễ đọc hơn, nhưng C6.6B cần inspect schema/runtime/localStorage/policy trước khi đổi convention sang hyphen. C6.6A không đổi runtime.

## 7. Center ID generation design

Design:

```txt
center_id = <slug>_prod
```

Ví dụ theo convention C6.6A:

```txt
Gò Vấp -> slug govap -> center_id govap_prod
Quận 12 -> slug quan12 -> center_id quan12_prod
Phú Nhuận -> slug phunhuan -> center_id phunhuan_prod
Bình Thạnh -> slug binhthanh -> center_id binhthanh_prod
```

Không tạo staging center tự động. Không clone center cũ.

## 8. Environment/status mặc định

New center mặc định:

```txt
environment = production
status = active
```

Không tạo staging center tự động, không tạo sandbox, không copy dữ liệu từ `dreamhome`, `dreamhome_prod` hoặc Angel Wings.

## 9. Định nghĩa ngôi nhà trống

"Ngôi nhà trống" nghĩa là chỉ tạo metadata center và owner membership cần thiết.

Không seed:

- học viên;
- giáo viên;
- lịch học;
- kho hàng;
- học phí;
- thông báo;
- báo cáo;
- dữ liệu Angel Wings;
- dữ liệu DreamHome production;
- dữ liệu staging.

Vì data modules đọc theo `center_id`, center mới chưa có records sẽ hiển thị trống hoặc trạng thái empty hợp lệ.

## 10. Owner membership requirement

Khi tạo center mới, hệ thống cần đảm bảo owner hiện tại có membership:

```txt
user_id = current owner user id
center_id = new center_id
role = owner
status = active
```

Owner membership giúp owner tiếp tục nhìn thấy/quản trị metadata center mới trong Internal Center Console. C6.6A chỉ thiết kế requirement, không tạo membership thật.

## 11. Admin cơ sở defer

C6.6A khuyến nghị không bắt buộc admin cơ sở trong flow một trường.

Lý do:

- tạo Auth user/admin account là tác vụ nhạy cảm;
- account management dễ trượt sang C7;
- C6.6 nên tập trung tạo center production empty trước;
- admin cơ sở có thể được gán trong phase/account flow riêng sau khi center đã tồn tại.

## 12. Duplicate/conflict handling

Trước khi tạo center, hệ thống phải kiểm:

- `center_id` đã tồn tại chưa;
- `slug + environment` đã tồn tại chưa;
- tên cơ sở rỗng/quá ngắn không;
- slug sinh ra có rỗng không;
- owner hiện tại có role hợp lệ để provision không.

Nếu trùng:

```txt
Tên cơ sở này tạo ra mã đã tồn tại. Vui lòng đổi tên hoặc thêm khu vực phân biệt.
```

Ví dụ `DreamHome` sinh `dreamhome_prod`, đã tồn tại, nên không tạo.

## 13. Option A frontend direct insert

Option A: frontend owner trực tiếp insert vào `centers` và `center_members`.

Ưu điểm:

- UX nhanh;
- ít lớp hạ tầng.

Nhược điểm:

- RLS phức tạp;
- client có quyền insert bảng nhạy cảm;
- dễ lộ surface mutation nếu guard chưa chặt;
- khó đảm bảo transaction giữa center và membership.

Recommendation C6.6A: không chọn frontend direct insert cho production flow đầu tiên.

## 14. Option B guarded SQL/RPC

Option B: tạo RPC guarded, ví dụ `provision_center_for_owner(center_name text)`.

RPC chịu trách nhiệm:

- normalize tên;
- sinh slug;
- sinh `center_id`;
- kiểm duplicate;
- insert `centers`;
- đảm bảo owner membership;
- chạy trong transaction;
- trả kết quả preview/created center.

Ưu điểm:

- logic nhạy cảm nằm trong DB;
- frontend chỉ gọi một hàm;
- dễ kiểm soát transaction;
- dễ audit SQL/policy.

Nhược điểm:

- cần SQL function/policy riêng;
- cần apply/review thủ công ở phase sau.

## 15. Option C manual apply/admin-only before UI

Option C: C6.6B/C chuẩn bị SQL/RPC và manual apply trước, UI gọi sau khi verified.

Ưu điểm:

- an toàn nhất cho production;
- có preflight/read-only inspection;
- kiểm được constraint/policy/RLS trước runtime;
- tránh tạo center thật khi chưa đủ guard.

Nhược điểm:

- chậm hơn;
- cần phase apply riêng.

## 16. Recommendation cho C6.6B/C

C6.6A khuyến nghị đi theo Option B có kiểm soát, triển khai theo Option C về quy trình:

- C6.6B: provisioning SQL/RPC design + read-only inspection pack;
- C6.6C: manual apply RPC/policy hoặc SQL function nếu được xác nhận;
- sau khi verify PASS mới mở runtime form.

Không nên để frontend direct insert thẳng vào `centers`/`center_members`.

## 17. Vì sao không clone DreamHome/Angel Wings

Center mới phải là production empty center, không phải bản sao.

Không clone vì:

- Angel Wings là staging/test sandbox trong `dreamhome`;
- DreamHome production `dreamhome_prod` là cơ sở riêng;
- clone dữ liệu có nguy cơ lẫn học viên/kho/học phí thật;
- production center mới cần sạch để nhập dữ liệu riêng;
- localStorage namespace phải tách theo `center_id`.

## 18. Vì sao không làm C7 account management

C7 account management gồm username login, tạo/sửa Auth user, phân quyền nâng cao, permission override, Teacher Portal và Super Admin advanced. Những việc này không nằm trong C6.6A.

C6.6A chỉ thiết kế tạo center empty và owner membership cần thiết. Admin center account defer sang phase riêng.

## 19. Risk list

Rủi ro cần xử lý ở C6.6B/C:

- schema constraint cho `centers.id`, `slug`, `environment`;
- unique constraint hoặc policy cho `slug + environment`;
- transaction giữa `centers` và `center_members`;
- quyền owner gọi RPC;
- duplicate/conflict race condition;
- convention slug có hyphen hay không;
- localStorage namespace với `center_id` mới;
- audit log cho provisioning;
- rollback nếu membership insert fail.

## 20. C6.6 phase split

Phase split đề xuất:

- C6.6A - Add center one-field UX audit/design.
- C6.6B - Provisioning SQL/RPC design + read-only inspection pack.
- C6.6C - Manual apply RPC/policy or SQL function, nếu được xác nhận.
- C6.6D - Runtime Add center form skeleton + dry-run/validation.
- C6.6E - Runtime create center via guarded RPC.
- C6.6F - Manual QA create test center.
- C6.6G - Checkpoint review.
- C6.6H - Commit/push.

Không nhảy thẳng từ C6.6A sang tạo center thật.

## 21. PASS / NEEDS REVIEW criteria

PASS nếu:

- docs/test audit design đầy đủ;
- UX một trường được chốt;
- slug/center_id generation được thiết kế;
- empty center được định nghĩa rõ;
- owner membership requirement rõ;
- admin center account deferred;
- duplicate/conflict handling rõ;
- không clone DreamHome/Angel Wings;
- không SQL/Supabase action;
- không tạo Auth user/membership/center mới;
- không runtime change;
- không mở C7;
- C6.5 smokes PASS;
- C6.6A smoke PASS;
- `npm run build` PASS;
- `git diff --check` PASS;
- không commit/push.

NEEDS REVIEW nếu worktree có file ngoài scope, cần SQL/runtime ngay trong C6.6A, phải tạo center thật, hoặc verification fail.
