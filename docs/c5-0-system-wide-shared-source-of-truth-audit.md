# C5.0 — Kiểm toán source-of-truth dùng chung toàn hệ thống

## Trạng thái và phạm vi

```text
C5_0_AUDIT_STATUS: PASS
C5_0_REGISTRY_MODULE_COUNT: 14
C5_0_OPERATIONAL_AUDIT_UNIT_COUNT: 43
C5_0_SHARED_CLOUD_COUNT: 4
C5_0_HYBRID_PARTIAL_COUNT: 13
C5_0_LOCAL_AUTHORITATIVE_COUNT: 17
C5_0_DERIVED_COUNT: 9
C5_0_SYSTEM_SHARED_TRUTH_ACCEPTANCE: FAIL / REMEDIATION REQUIRED
C5_0_REBUILD_FROM_SCRATCH: NO
C5_0_RUNTIME_REMEDIATION: NOT STARTED
C5_0_REMOTE_OPERATION: NO
F23_3E_P4B_STATUS: FROZEN / MANUAL PRODUCT E2E PENDING / NOT DONE
```

C5.0 chỉ kiểm toán physical repo truth tại checkpoint P4B freeze. Không có runtime, migration, RLS, UI hay remote backend nào được sửa trong audit này. `PASS` ở đây chỉ có nghĩa là inventory và kế hoạch remediation đã đủ bằng chứng; nó không có nghĩa dữ liệu toàn hệ thống đã dùng chung.

## Tóm tắt cho người vận hành

- Registry hiện có **14 module**, gồm 12 module nghiệp vụ trực tiếp, một wrapper Tài chính và một placeholder.
- Audit chia nhỏ thành **43 đơn vị dữ liệu/vận hành**: 4 đã dùng cloud thật, 13 hybrid/partial, 17 vẫn local-authoritative và 9 là derived.
- **Không cần rebuild OS từ đầu.** Auth, center membership/RLS, generic cloud entity/realtime, attachment storage, canonical CRM P1–P4B và toàn bộ UI shell là nền có thể giữ lại.
- **17 đơn vị đã có cloud foundation trực tiếp** (4 shared + 13 hybrid) để tái sử dụng; 9 đơn vị derived sẽ tự hội tụ khi nguồn upstream được sửa. 17 local-authoritative cần authoritative contract hoặc product wiring mới.
- Nguyên nhân quan sát “Owner thấy, Admin không thấy” là hợp với code: nhiều thao tác ghi vào key local theo center của từng browser; có nơi cloud write chỉ chạy bất đồng bộ sau local write, có nơi không có cloud write nào.
- Clearing localStorage hiện có thể xóa hoặc thay đổi business state nhìn thấy ở nhiều module. Vì vậy product invariant dùng chung chưa đạt.

## Quy tắc phân loại

- **A — SHARED / CLOUD AUTHORITATIVE:** server là authority; local chỉ là cache/projection có thể tái tạo.
- **B — HYBRID / PARTIAL:** có cloud path nhưng vẫn có local-first, local fallback, deferred remote apply hoặc product wiring chưa đủ để cloud là authority duy nhất.
- **C — LOCAL AUTHORITATIVE:** business truth nằm trong localStorage, session/memory hoặc sample state; browser khác không thể hội tụ tin cậy.
- **D — DERIVED:** không có write authority riêng; kết quả phụ thuộc upstream và kế thừa rủi ro của upstream.

Sync được ghi theo bốn mức: `REALTIME`, `REFRESH-ONLY`, `BOOTSTRAP-ONLY`, `NO SHARED SYNC`.

## Module registry đã kiểm

Physical `src/modules.js` có đúng các module:

```text
hoc-vien
khach-hang-tu-van
giao-vien
nhan-vien
thoi-khoa-bieu
hoc-phi
nhom-tai-chinh
thu-chi
so-quy
kho-hang
bao-cao
cai-dat-co-so
bang-diem-danh
dang-cap-nhat
```

`dang-cap-nhat` chỉ là placeholder, không sở hữu durable business state. `nhom-tai-chinh` chỉ điều hướng đến Thu chi/Sổ quỹ nên là derived.

## Bản đồ dễ đọc

| # | Module / dữ liệu | Đọc từ đâu | Ghi vào đâu | Hiện dùng chung? | Realtime? | Phân loại | Mức nguy hiểm | Hướng xử lý |
|---:|---|---|---|---|---|---|---|---|
| 1 | Học viên legacy: hồ sơ/danh sách | `students` trong memory/local cache, bootstrap `center_cloud_entities` | local trước; `upsertStudentCloudEntity`/snapshot sau | PARTIAL | REALTIME | B — HYBRID/PARTIAL | CRITICAL | Cloud phải là authority; local chỉ cache, write lỗi không được coi là đã lưu |
| 2 | Học viên: care note/phân ca nhúng trong payload | Cùng payload Student | `saveStoredStudents`, rồi cloud async | PARTIAL | REALTIME theo Student | B | HIGH | Tách command/version hoặc bắt buộc cloud commit trước success |
| 3 | Canonical Student/Guardian/binding/relationship P3C/P3D | Protected RPC/tables trong migration P3 | Atomic P3D executor | Chưa ở product remote | REFRESH-ONLY | B | HIGH | Tái dùng canonical foundation; remote apply vẫn là gate riêng |
| 4 | Projection P4B sang UI Học viên | `crm_conversion_bridge_session` qua Edge status; cache `sessionStorage` | server result + session cache | PARTIAL, chỉ browser đã chạy conversion | REFRESH-ONLY | B | CRITICAL | Có server list/read projection exact-center để browser mới tái tạo |
| 5 | Giáo viên và assignment nhúng | local cache + generic cloud bootstrap | local trước; `upsertTeacherCloudEntity` sau | PARTIAL | REALTIME | B | HIGH | Cloud-first/versioned write, bỏ authoritative fallback |
| 6 | Nhân viên: roster vận hành | `ichessCenterOS.centerStaffMembers.<center>` | localStorage | NO | NO SHARED SYNC | C — LOCAL-AUTHORITATIVE | HIGH | Tạo shared staff aggregate hoặc nối vào membership/profile hợp lệ |
| 7 | Nhân viên: phòng ban | `centerDepartments` local | localStorage | NO | NO SHARED SYNC | C | HIGH | Shared exact-center department authority |
| 8 | Hồ sơ hành chính nhân sự | `centerStaffAdministrativeProfiles` local | localStorage | NO | NO SHARED SYNC | C | HIGH | Protected shared profile contract, không browser authority |
| 9 | Chỉ mục hồ sơ, audit/retention/deletion nhân sự | 5 collection local trong `storage.js` | localStorage | NO | NO SHARED SYNC | C | HIGH | Nối metadata/governance vào backend hiện có của attachment |
| 10 | File đính kèm hồ sơ nhân sự | `center_staff_document_attachments` + private Storage/RPC | protected RPC + private bucket | YES cho metadata/object | REFRESH-ONLY | A — SHARED/CLOUD | MEDIUM vì parent local | Giữ nền; liên kết với shared document parent |
| 11 | Center, account membership và public member profile | `centers`, `center_members`, Auth | server/RPC hoặc self-profile update | YES | REFRESH-ONLY | A | LOW | Giữ; dùng làm root cho mọi shared entity |
| 12 | Ca học/lớp trong Cài đặt | local cache + `class_session` generic cloud | local rồi queue snapshot cloud | PARTIAL | BOOTSTRAP-ONLY | B | CRITICAL | Cloud-first; thêm entity-specific refresh/realtime hoặc reload convergence |
| 13 | Thời khóa biểu `schedule_session` | local cache + generic cloud | local rồi `upsertScheduleSessionCloudEntity` | PARTIAL | REALTIME | B | HIGH | Cloud commit/version/conflict trước success; local chỉ projection |
| 14 | Calendar item/tag bổ sung | `centerCalendarItems/Tags` local | localStorage | NO | NO SHARED SYNC | C | HIGH | Shared calendar tables/entity contract; giữ schedule dependency |
| 15 | Báo cáo buổi học `session_report` | local + C5.1 generic cloud | local trước; C5.1 async upsert | PARTIAL | REALTIME | B | CRITICAL | Cloud-first transactional write; finite conflict policy |
| 16 | Attendance record | local + `attendance_record` generic cloud | local trước; C5.1 async upsert | PARTIAL | REALTIME | B | CRITICAL | Chuyển cloud thành authority; không giữ local success khi cloud fail |
| 17 | Attendance baseline/lock state | local + `attendance_baseline_state` | local trước; C5.1 async upsert | PARTIAL | REALTIME | B | CRITICAL | Atomic baseline/version lock ở server |
| 18 | Attendance advisory notes | `attendanceAdvisoryNotes` local | localStorage | NO | NO SHARED SYNC | C | HIGH | Shared note entity hoặc gắn server-side với attendance/student |
| 19 | Ghi chú Bảng điểm danh | `attendanceBoardNotes` local | localStorage | NO | NO SHARED SYNC | C | HIGH | Shared exact-center board-note authority |
| 20 | Bảng điểm danh | Student + class + tuition + session report + attendance + notes | Không authority riêng | PARTIAL theo upstream | Theo upstream | D — DERIVED | CRITICAL | Không rebuild board; sửa upstream 1/12/15–19/21 trước |
| 21 | Học phí/gói/ghi nhận thanh toán | `tuition` local + `tuition_record_package` cloud | local trước; C5.2 async upsert | PARTIAL | REALTIME | B | CRITICAL | Cloud-first, idempotency/version/conflict và reload convergence |
| 22 | Ghi chú/chăm sóc/cảnh báo học phí nhúng | tuition payload + attendance advisory | local/hybrid payload | PARTIAL | Theo tuition | B | HIGH | Định danh field ownership; server command hoặc shared note entity |
| 23 | CRM lead/khách tư vấn list | `parentConsultations` local | `saveStoredParentConsultations` | NO | NO SHARED SYNC | C | CRITICAL | Nối UI lead list vào canonical Contact/Case; không chỉ ingress lúc convert |
| 24 | CRM care log/appointment/enrollment draft | object con trong `parentConsultations` | localStorage | NO | NO SHARED SYNC | C | CRITICAL | Dùng P1 typed CRM operations/Case/Assignment/Care Log; draft UI chỉ local trước submit |
| 25 | Canonical CRM ingress/review/conversion P1–P4B | protected CRM tables/RPC/Edge trong repo | service bridge, atomic Audit/Outbox | Local QA có; product remote chưa apply | REFRESH-ONLY | B | CRITICAL | `CLOUD FOUNDATION EXISTS — PRODUCT WIRING INCOMPLETE`; giữ security boundary |
| 26 | Thu chi: giao dịch | `cashflow` local | localStorage | NO | NO SHARED SYNC | C | CRITICAL | Canonical finance transaction table/RPC, idempotency và RLS |
| 27 | Thu chi: danh mục | `cashflowCategories` local | localStorage | NO | NO SHARED SYNC | C | CRITICAL | Shared category authority trước report/cashbook |
| 28 | Ảnh giao dịch | `transaction_attachments` + private Storage | Supabase table/bucket | YES cho ảnh/metadata | REFRESH-ONLY | A | MEDIUM vì transaction parent local | Giữ foundation; FK/logical bind tới shared transaction |
| 29 | Sổ quỹ: số dư đầu kỳ/cài đặt | `cashbookSettings` local | localStorage | NO | NO SHARED SYNC | C | CRITICAL | Server aggregate/versioned settings |
| 30 | Sổ quỹ: đối soát/chốt sổ | `cashbookReconciliations` local | localStorage | NO | NO SHARED SYNC | C | CRITICAL | Atomic reconciliation + audit, immutable terminal state |
| 31 | Sổ quỹ: tổng thu/chi/số dư | Cashflow + settings + reconciliation | Không authority riêng | NO vì upstream local | NO SHARED SYNC | D | CRITICAL | Recompute từ shared finance authority, không copy số tổng |
| 32 | Kho: vật tư/tồn | `inventory` local | localStorage | NO | NO SHARED SYNC | C | HIGH | Shared inventory item + optimistic version |
| 33 | Kho: nhập/xuất/movement | `inventoryMovements` local | localStorage | NO | NO SHARED SYNC | C | HIGH | Server transaction, atomic quantity mutation |
| 34 | Kho: đề xuất/yêu cầu | `inventoryRequests` local | localStorage | NO | NO SHARED SYNC | C | HIGH | Shared request lifecycle + assignment/audit |
| 35 | Báo cáo: số HV, tiền, điểm danh, chart | Student + cashflow + attendance hiện tại | Không authority riêng | PARTIAL/NO theo metric | Theo upstream | D | CRITICAL | Không rebuild Report; sửa upstream rồi query/projection lại |
| 36 | Báo cáo: công việc/vấn đề/ghi chú/người phụ trách | `reportState.draft` memory-only | memory, mất khi reload | NO | NO SHARED SYNC | C | HIGH | Shared operational report draft/final lifecycle nếu là nghiệp vụ |
| 37 | Cài đặt: thông tin cơ sở | binding + chuỗi hard-code `DreamHome`, trạng thái dựng ở `main.js` | Không có edit authority | Không phải source thật | REFRESH-ONLY một phần | D | HIGH | Đọc `centers` canonical; không hard-code tên/trạng thái |
| 38 | Cài đặt: gói học phí | Derived từ tuition records | Không authority riêng | PARTIAL | Theo tuition | D | HIGH | Sau khi tuition shared, projection này tự hội tụ |
| 39 | Cài đặt: danh mục nhập mẫu | Static/sample code | Không ghi business state | N/A | N/A | D | LOW | Giữ static hoặc tạo catalog shared chỉ nếu được dùng nghiệp vụ |
| 40 | Notification Center | Derived từ tuition/inventory/CRM + local read/deleted state | localStorage | PARTIAL theo upstream, read state từng browser | NO SHARED SYNC | D | MEDIUM | Event/outbox shared; read-state user-scoped server nếu cần đa thiết bị |
| 41 | Nhóm Tài chính wrapper | Thu chi + Sổ quỹ | Không authority riêng | NO theo upstream | N/A | D | CRITICAL | Không sửa wrapper trước finance/cashbook |
| 42 | Nhân viên: bảng chấm công/tổng buổi | Staff + teacher + schedule + report | Không authority riêng | PARTIAL/NO theo upstream | Theo upstream | D | HIGH | Sửa roster/schedule/attendance trước |
| 43 | Audit log/rollback preview generic C5.3 | `audit_log_entry` trong `center_cloud_entities` | `writeC53AuditLogEntry` (hiện chủ yếu tuition) | YES cho entry được ghi | REFRESH-ONLY | A | MEDIUM vì coverage hẹp | Giữ; mở rộng sau khi authority của entity gốc hoàn tất |

## Chứng cứ vật lý load-bearing

1. `src/storage.js` khởi tạo 26 key center-scoped và các hàm `getStored*`/`saveStored*` đều đọc ghi localStorage.
2. `reloadLocalDataForResolvedCenter()` nạp CRM, finance, cashbook, inventory, staff, notes và nhiều module khác trực tiếp từ local browser.
3. Student/Teacher/Class/Schedule bootstrap dùng `center_cloud_entities`, nhưng `applyCloudBootstrapSnapshotToLocal()` chỉ thay collection có cloud rows; khi cloud lỗi/thiếu, local cache được giữ.
4. Student/Teacher/Schedule/Attendance/Tuition handler lưu local trước rồi gọi cloud write bất đồng bộ; UI không rollback business state khi cloud write thất bại.
5. `parentConsultations` không nằm trong `CLOUD_ENTITY_TYPES`; P4B chỉ canonical-ingress khi người dùng chủ động prepare conversion. Vì vậy tạo lead không làm Admin khác thấy lead.
6. Cashflow/cashbook/inventory không có business table hay generic entity runtime. Chỉ ảnh giao dịch có `transaction_attachments` và private bucket.
7. Staff account directory đọc `center_members`, và attachment dùng backend riêng; roster, departments, admin profile, document index và governance state vẫn local.
8. `report-module.js` tính số liệu trực tiếp từ arrays Student/Cashflow/Attendance được truyền từ `main.js`; report không gây divergence riêng nhưng kế thừa divergence upstream. Operational draft chỉ nằm trong memory.
9. `settings-module.js` đọc class sessions và tuition từ state hiện tại; center name/status có hard-code, không phải canonical center profile.
10. Remote schema snapshot có RLS theo `center_id` và Realtime cho `center_cloud_entities`, nhưng có policy trùng cho phép mọi center member insert/update/delete bên cạnh policy writer. Client role gate không thay server authorization; remediation Wave 1 phải audit/harden policy union.
11. Canonical CRM/P3/P4A/P4B migrations được forced-RLS/protected và đã local QA, nhưng roadmap/reports xác nhận remote apply/deploy `NOT RUN`.

## Multi-account và cross-center

### Contract hiện tại

- Với A, Account A ghi server và Account B cùng center có thể đọc sau reload; khác center bị RLS giới hạn.
- Với B, hội tụ có thể xảy ra khi cloud write và subscription/bootstrap đều thành công, nhưng local-first/fallback cho phép hai browser giữ hai truth khi lỗi, empty snapshot, role bị hold hoặc remote object chưa apply.
- Với C, Account B không có đường đọc state của Account A. Cùng chuỗi center trong key chỉ namespace dữ liệu trên một browser, không tạo chia sẻ hay server isolation.
- Với D, kết quả chỉ chính xác bằng nguồn upstream yếu nhất.

### Kết luận rule A → B

```text
Account A cùng center tạo/sửa
→ Account B cùng center reload thấy cùng authoritative state
```

Hiện chỉ bảo đảm cho 4 đơn vị A. Không bảo đảm hệ thống-wide cho 13 B, 17 C và 9 D.

Cross-center cloud có RLS foundation. Local keys tách theo normalized center ID ở normal UI path, nhưng đây không phải security boundary; người dùng/client code có thể thao tác localStorage và không có server policy bảo vệ.

## Inventory localStorage/sessionStorage

### Business-authoritative hoặc hybrid cần remediation

```text
ichessCenterOS.students.<center>
ichessCenterOS.classSessions.<center>
ichessCenterOS.tuition.<center>
ichessCenterOS.teachers.<center>
ichessCenterOS.centerStaffMembers.<center>
ichessCenterOS.centerStaffAdministrativeProfiles.<center>
ichessCenterOS.centerStaffDocuments.<center>
ichessCenterOS.centerStaffAdministrativeAuditEvents.<center>
ichessCenterOS.centerStaffAdministrativeRetentionPolicies.<center>
ichessCenterOS.centerStaffAdministrativeDeletionRequests.<center>
ichessCenterOS.centerDepartments.<center>
ichessCenterOS.schedule.<center>
ichessCenterOS.sessionReports.<center>
ichessCenterOS.attendanceAdvisoryNotes.<center>
ichessCenterOS.attendanceBoardNotes.<center>
ichessCenterOS.parentConsultations.<center>
ichessCenterOS.cashflow.<center>
ichessCenterOS.cashflowCategories.<center>
ichessCenterOS.cashbookSettings.<center>
ichessCenterOS.cashbookReconciliations.<center>
ichessCenterOS.inventory.<center>
ichessCenterOS.inventoryMovements.<center>
ichessCenterOS.inventoryRequests.<center>
ichessCenterOS.attendanceRecords.<center>
ichessCenterOS.attendanceBaselineState.<center>
ichessCenterOS.centerCalendarItems.<center>
ichessCenterOS.centerCalendarTags.<center>
ichessCenterOS.tuitionPackages.dreamhome
```

`tuitionPackages.dreamhome` là legacy fixture/catalog key; runtime Settings hiện derive package từ tuition rows. Nó cần retire hoặc đổi thành cache có nguồn tái tạo rõ ràng, không tiếp tục làm catalog song song.

### Cache/projection có thể xóa và tái tạo khi server path đầy đủ

```text
ichess.crmConversionProjection.v1:<center>:<source>
ichessCenterOS.backup.beforeCloudPull.*
ichessCenterOS.backup.beforeAttendanceRecordPull.*
ichessCenterOS.backup.beforeF15K5AngelWings.*
```

P4B projection hiện chưa tái tạo được bằng một server list khi browser mới chưa biết source/session, nên vẫn được xếp B thay vì cache thuần.

### UI-only / per-browser

```text
ichess-center-os:view-mode
ichess-center-os:desktop-module-order
ichessCenterOS.notifications.<center>
ichessCenterOS.notifications.version.<center>
ichessCenterOS.notifications.deletedIds.<center>
```

View/order được phép local. Notification content phần lớn derived; read/deleted state hiện là browser-local và cần user-scoped server state chỉ khi sản phẩm yêu cầu đa thiết bị.

## Cloud foundation có thể tái sử dụng

| Foundation | Đang hỗ trợ | Khoảng trống |
|---|---|---|
| Auth + `centers` + `center_members` | Login, exact center, account/profile | Dùng nó làm root mọi shared command; không hard-code DreamHome |
| `center_cloud_entities` + Realtime + RLS | Student, Teacher, Class, Schedule, Attendance, Session report, Tuition, audit | Local-first/fallback, generic payload/version, policy union rộng, incomplete delete/conflict semantics |
| Canonical CRM P1–P4B | Contact/Case/Candidate/Review/Reservation/Target/Conversion/Audit/Outbox | Chưa remote apply; lead list/care UI chưa dùng canonical source |
| `transaction_attachments` + private bucket | Ảnh Thu chi | Parent transaction local, chưa có authoritative binding |
| Staff protected attachment backend | File/version/history/legal hold | Parent document/profile/governance catalog local |
| Realtime adapters | Student/Teacher/Schedule/Attendance/Tuition | Class session chỉ bootstrap; failure vẫn giữ local success |

## Finding theo mức độ

### CRITICAL

1. **C5-CR1 — CRM identity/enrollment split-brain:** lead/care/appointment/draft local trong khi canonical conversion backend tồn tại tách biệt. Đây là nguyên nhân trực tiếp Owner tạo lead nhưng Admin không thấy.
2. **C5-CR2 — Finance/cashbook split-brain:** transaction, category, opening balance và reconciliation đều local; ảnh cloud không làm giao dịch thành shared truth.
3. **C5-CR3 — Attendance/tuition local-first:** có Realtime/cloud foundation nhưng UI đã lưu local và báo success trước cloud; lỗi/role hold/empty cloud cho phép divergence ảnh hưởng điểm danh và tiền.
4. **C5-CR4 — Core Student/Class split-brain:** Student và Class là upstream của schedule, attendance, tuition, report; cache/fallback có thể khác giữa browser.
5. **C5-CR5 — Derived decision screens inherit mixed truth:** Attendance board, Cashbook, Finance workspace và Report hiển thị số khác nhau vì nguồn không authoritative thống nhất.

### HIGH

1. **C5-H1 — Staff/HR:** roster, department và hồ sơ hành chính local; protected attachment cloud bị orphan khỏi parent shared record.
2. **C5-H2 — Inventory:** item/movement/request hoàn toàn local, có thể tạo tồn kho và request trái nhau.
3. **C5-H3 — Schedule/calendar/notes:** schedule có hybrid cloud nhưng calendar tag/item, advisory và board note local.
4. **C5-H4 — Server write policy mismatch:** current `center_cloud_entities` policy union rộng hơn client role gate; phải harden bằng server contract, không dựa frontend.
5. **C5-H5 — Settings/Report drafts:** center info hard-code và operational report draft memory-only, không phải shared center state.

## Quyết định rebuild

```text
REBUILD FROM SCRATCH: NO
```

Lý do: phần khó và rủi ro cao đã có nền đáng giữ — Supabase Auth/membership/RLS, center root, Realtime, generic cloud adapter, canonical CRM/identity/conversion atomic backend, Audit/Outbox, private attachment storage và module UI. C5 nên thay authority từng dependency layer, không viết lại shell hoặc business UI hàng loạt.

## Thứ tự remediation theo dependency

### Wave 1 — Authority foundation và core upstream

1. Freeze contract chung: server commit trước success, version/idempotency/conflict, exact-center RLS, local chỉ cache.
2. Audit/harden policy `center_cloud_entities`; loại quyền rộng ngoài intended role.
3. Chốt authority cho Student/Teacher/Class/Schedule và product projection canonical Student.
4. Thêm multi-account harness dùng hai user cùng center và một user khác center.

### Wave 2 — CRITICAL transactional domains

1. Attendance record/baseline/session report trên foundation C5.1 hiện có.
2. Tuition record/package/payment trên C5.2 foundation hiện có.
3. CRM lead/care/appointment/assignment nối P1–P4B; không duplicate local lead authority.
4. Finance transaction/category/cashbook/reconciliation; tái dùng attachment private storage.

### Wave 3 — Remaining operational truth

1. Staff roster/department/admin profile/document metadata, gắn attachment backend hiện có.
2. Inventory item/movement/request.
3. Calendar item/tag, advisory note, board note và notification event/read-state phù hợp.

### Wave 4 — Derived convergence và system acceptance

1. Rewire Settings, Attendance board, Cashbook, Finance workspace và Report chỉ đọc authoritative upstream.
2. Retire authoritative local keys/legacy sample fallback; local cache phải xóa được và bootstrap lại.
3. Chạy full multi-account, multi-browser, different-center, reload/realtime và conflict acceptance.
4. Khi C5 DONE, quay lại F23.3E-P4B trước mọi feature khác để đơn giản hóa UX và hoàn tất manual E2E.

## Exact next gate

```text
C5.1 — AUTHORITATIVE CORE CONTRACT + MULTI-ACCOUNT HARNESS
```

Gate này phải design/implement contract dùng chung cho Student/Teacher/Class/Schedule và harden generic cloud policy/write semantics trước khi sửa các màn derived. Nó không được sửa từng màn hình bằng cách copy localStorage sang tài khoản khác.

## C5 exit criteria

Với mọi durable same-center shared entity:

```text
A tạo → B cùng center thấy sau sync/reload được quy định
B sửa → A thấy authoritative result
browser/device mới bootstrap được cùng result
user khác center không đọc/ghi được
xóa localStorage không xóa business truth
cloud/server write fail → UI không được tuyên bố business save thành công
```

Entity cần realtime phải thêm:

```text
A thay đổi → B cập nhật không reload trong timeout đã quy định
```

Closeout C5 bắt buộc có hai authenticated user khác nhau, hai browser context độc lập cùng center, ít nhất một context khác center, localStorage/sessionStorage độc lập, reload/new-device, concurrent edits và fault injection. Smoke tài liệu C5.0 không giả vờ thay thế các runtime test đó.

## Boundary sau audit

- P4B: `FROZEN / MANUAL PRODUCT E2E PENDING / NOT DONE`.
- C5 remediation: chưa bắt đầu trong C5.0.
- Remote Supabase/db/functions/Auth/Storage/deploy: `NO`.
- Sau C5 DONE: quay lại P4B là ưu tiên cao nhất trước mọi feature khác.
