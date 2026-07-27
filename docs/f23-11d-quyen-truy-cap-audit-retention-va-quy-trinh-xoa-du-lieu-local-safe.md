# F23.11D — Quyền truy cập, audit, retention và quy trình xóa dữ liệu local-safe

Ngày triển khai: 2026-07-27  
Phạm vi: runtime local-safe trên `main`, không migration, không Auth write, không Supabase/SQL/Storage/deploy và không thay đổi Teacher Workspace.

## Kết quả và ranh giới kiến trúc

F23.11D bổ sung governance cho Hồ sơ hành chính mà không nhập dữ liệu này vào `centerStaffMembers`. Ba entity mới đều center-scoped:

- `centerStaffAdministrativeAuditEvents` — nhật ký append-only đã redaction;
- `centerStaffAdministrativeRetentionPolicies` — một policy canonical cho current center;
- `centerStaffAdministrativeDeletionRequests` — workflow yêu cầu, xem xét và chờ backend.

Chuỗi dữ liệu vẫn là `current center → unique Staff → tối đa một administrative profile → nhiều Staff Documents`. Governance tham chiếu stable IDs; không sao chép employment status, end date, lifecycle history, profile completion, document validity, Teacher link hoặc account link. Retention đọc Staff lifecycle canonical nhưng không mutate nguồn đó.

Phase này tuyệt đối không hard-delete profile, document, attachment metadata hoặc Staff. Approval chỉ tạo trạng thái `Chờ thực thi backend`; không có executor giả, timer, cron hoặc cleanup khi app load.

## Current membership contract đã audit

Runtime hiện lấy user từ `cloudStatus.user`, resolve binding bằng `resolveAppCenterBinding`, và mutation đọc lại membership qua `resolveActiveCenterMembership`. Authorization không dùng tên, email, chức danh, phòng ban, Teacher link hay account display name.

Membership hợp lệ phải thỏa đồng thời:

1. user đã đăng nhập và có stable user ID;
2. binding là `bound`;
3. membership là object hợp lệ, status `active`;
4. membership center, binding center và current storage center trùng chính xác;
5. membership user ID, nếu có, khớp current user;
6. role sau normalize thuộc allowlist.

Sai/mất một điều kiện đều deny-by-default trước render dữ liệu nhạy cảm. Alias lịch sử `admin` chỉ được normalize thành `center_admin`; không mở rộng quyền cho role khác.

### Membership ID compatibility

Current membership reader chỉ select `center_id`, `role`, `status`, nên membership database ID có thể chưa có trong object. Audit ưu tiên `membership.id`/alias khi runtime cung cấp; nếu thiếu, F23.11D dùng local audit reference ổn định `membership-ref:<centerId>:<userId>`. Đây chỉ là actor reference cho local audit, không phải membership ID cloud và không được dùng để nới authorization. Backend phase phải đưa canonical membership ID vào read contract.

## Action-level access matrix

Action-based access matrix được resolve riêng cho từng thao tác:

| Action | active owner | active center_admin | teacher / consultant / inactive / malformed |
| --- | --- | --- | --- |
| `administrative-profile.view` | Có | Có | Không |
| `administrative-profile.reveal-sensitive` | Có | Có | Không |
| `administrative-profile.edit` | Có | Có | Không |
| `staff-document.view/create/edit/archive/restore` | Có | Có | Không |
| `privacy-audit.view` | Có | Có | Không |
| `retention-policy.view/manage` | Có | Không | Không |
| `deletion-request.create` | Có | Có | Không |
| `deletion-request.cancel` | Có, pending theo policy | Chỉ pending do chính actor tạo | Không |
| `deletion-request.review/approve/deny` | Có | Không | Không |

Active `center_admin` được xem derived retention status nhưng không xem các con số policy chi tiết và không thấy policy editor. UI button không phải security boundary: mọi mutation đều re-read membership và check action, center, stable relationship và latest revision ngay trước write.

## Separation of duties

Request creator không được approve hoặc deny chính request của mình. Guard so cả `requestedByUserId` và `requestedByMembershipId`; chỉ cần một khóa trùng reviewer là dừng. UI không render review buttons và hiển thị:

`Cần một Owner khác phê duyệt`

Helper review lặp lại guard nên synthetic DOM action cũng không bypass được. `center_admin` không thể tự nâng quyền; active owner khác mới review được. Owner vẫn có thể cancel pending request theo policy, còn center_admin chỉ cancel pending request do chính membership/user đó tạo.

## Append-only audit

Storage key: `ichessCenterOS.centerStaffAdministrativeAuditEvents.<centerId>`.

Audit event schema v1:

```js
{
  id,
  schemaVersion: 1,
  centerId,
  actorUserId,
  actorMembershipId,
  actorRole,
  action,
  targetType,
  targetId,
  staffMemberId,
  administrativeProfileId,
  documentId,
  outcome,
  reasonCode,
  noteSummary,
  requestId,
  createdAt
}
```

Audit là logical append-only: storage chỉ export append API, không có edit/delete/bulk-save API cho events. Mỗi append đọc latest collection, kiểm tra malformed/duplicate/center và thêm event mới. Unknown field được preserve khi đọc để không làm mất evidence, nhưng vì audit dùng allowlist nghiêm ngặt nên collection có field ngoài schema chuyển read-only và không bị append/rewrite. JSON lỗi không bị xóa hoặc rewrite. F23.11D không tự trim audit cũ; UI chỉ render newest-first tối đa 100 events bằng `Xem thêm`.

Các explicit success được audit: mở window lần đầu, reveal một canonical field key, create/edit profile, completion review, create/edit/archive/restore document, update policy, create/cancel/approve/deny request. Focus window đã tồn tại, scroll, filter, hover, minimize, navigation và mask lại không tạo event, tránh audit spam.

## Audit allowlist và redaction

Builder chỉ nhận các field schema cho phép. `noteSummary` phải là canonical token ngắn, ví dụ field key hoặc state transition; không nhận free text. Renderer chỉ hiển thị thời gian, role label an toàn, action, target type, outcome và reason label. Raw user/membership/target IDs không hiển thị mặc định.

Audit cấm profile/document snapshot, form payload, HTML, raw error, địa chỉ, ngày sinh, điện thoại, số giấy tờ, mã số thuế, số bảo hiểm, số tài khoản, full note, document title/number/note, attachment name, bucket/path, binary/base64/blob và signed/public URL. Runtime không stringify profile hoặc document vào audit/log. Reveal ghi canonical field key, không ghi field value.

Audit storage malformed làm window chuyển safe state và khóa dữ liệu hành chính; reveal chỉ xảy ra sau khi append event tối giản thành công. Profile/document/governance mutations cũng kiểm tra audit storage trước write. Append thất bại không được che bằng thông báo success giả.

### Denied audit behavior

Schema hỗ trợ outcome `denied`, `validation-failed`, `stale` và `cancelled`. F23.11D không tự ghi denied event khi membership/current center không đủ tin cậy, vì như vậy có thể ghi sai namespace hoặc cho attacker tạo spam. Deny vẫn xảy ra trước render sensitive data. Backend security audit sau này có thể ghi denial vào trusted sink khi actor và center provenance đã được xác thực.

## Retention policy

Storage key: `ichessCenterOS.centerStaffAdministrativeRetentionPolicies.<centerId>`.

`centerStaffAdministrativeRetentionPolicies` có đúng một current policy object cho center:

```js
{
  id,
  schemaVersion: 1,
  centerId,
  profileRetentionDaysAfterEmploymentEnd,
  documentRetentionDaysAfterEmploymentEnd,
  deletionReviewGraceDays,
  enabled,
  revision,
  createdAt,
  updatedAt
}
```

Chỉ Owner xem con số và mở `Thiết lập chính sách lưu trữ`. Empty state không tự tạo key. Form gợi ý 1825/1825/30 ngày nhưng chỉ persist sau explicit submit. Các số phải là integer, không âm và trong giới hạn; không chấp nhận `NaN`, không autosave. Policy là cấu hình vận hành nội bộ, không thay thế tư vấn pháp lý; trung tâm phải xác nhận theo pháp luật và policy nội bộ.

### Derived retention status

Derived retention status không persist và không có input sửa tay. Nguồn ngày duy nhất là Staff `employmentStatus` + `endDate` canonical:

- Staff đang làm việc hoặc thiếu end date: `Không áp dụng`;
- đã nghỉ, policy hợp lệ, còn xa ngày review: `Đang lưu trữ`;
- còn tối đa 30 ngày: `Sắp đến hạn rà soát`;
- tới/quá ngày review: `Đến hạn rà soát`;
- có pending request: `Đang có yêu cầu xóa`;
- request đã approve: `Chờ thực thi backend`.

Không suy đoán retention từ Teacher/account status, profile archive date, document expiry date hay document archive. Policy missing hiển thị `Chưa thiết lập chính sách lưu trữ.` và không silently persist default.

### No-auto-delete boundary

Retention chỉ tính status và hỗ trợ review/request. Không có timeout, interval, cron, xóa lúc load/open, xóa khi expiry tới hạn, cascade archive hoặc localStorage cleanup. Ngay cả `Đến hạn rà soát` cũng không thay đổi Staff, profile, document hoặc attachment.

## Deletion request workflow

Storage key: `ichessCenterOS.centerStaffAdministrativeDeletionRequests.<centerId>`.

`centerStaffAdministrativeDeletionRequests` schema v1:

```js
{
  id,
  schemaVersion: 1,
  centerId,
  staffMemberId,
  administrativeProfileId,
  scope,
  reasonCode,
  reasonNote,
  status,
  requestedByUserId,
  requestedByMembershipId,
  requestedByRole,
  requestedAt,
  reviewedByUserId,
  reviewedByMembershipId,
  reviewedByRole,
  reviewedAt,
  reviewNote,
  approvedAt,
  deniedAt,
  cancelledAt,
  executionEligibleAt,
  executionState,
  revision,
  createdAt,
  updatedAt
}
```

Unknown fields hợp lệ được preserve. Request không chứa snapshot hoặc raw profile/document metadata.

Scope allowlist chỉ gồm `administrative-profile`, `staff-documents`, `administrative-profile-and-documents`. Không thể chọn Staff operational record, Teacher, account, attendance, tuition, cashflow hoặc schedule.

Reason codes gồm `data-subject-request`, `duplicate-record`, `incorrect-record`, `retention-review`, `other`. Reason note bắt buộc 12–500 ký tự, escape tại render, có cảnh báo và runtime chặn giá trị raw đã biết từ profile/documents. Review note tối đa 500 ký tự và dùng cùng privacy guard.

Status transition:

```text
create -> pending-review
pending-review -> cancelled
pending-review -> denied
pending-review -> execution-pending
```

`executed` và `failed` là future-only; F23.11D không tạo. Approve tính `executionEligibleAt` từ `deletionReviewGraceDays`, đặt `executionState: waiting-backend`, giữ nguyên mọi dữ liệu và hiển thị `Đã phê duyệt — chờ thực thi backend`.

Cancel chỉ áp dụng pending chưa review. Approve/deny chỉ active owner khác creator. Mọi transition giữ request history, tăng revision đúng một lần và ghi audit tối giản. Không có button `Xóa ngay`, `Thực thi`, `Xóa khỏi Supabase` hoặc `Xóa tệp`.

## Revision, stale guard và double-submit

Policy và request có revision riêng. Editor capture `expectedRevision` + `expectedUpdatedAt`; trước save runtime re-read membership, current center và latest storage. Create policy còn guard “expected absent”; request review/cancel so latest status, actor, stable relationship, revision và timestamp. Lệch snapshot dừng bằng message canonical và không overwrite.

Per-window saving set chặn double-submit. Không timeout, synthetic click hoặc full-app rerender cho governance form/filter. Validation giữ draft in-memory. Policy/request/audit không tăng profile revision, không đổi profile completion và không đổi document revision.

## Center scope, window, taskbar, focus và scroll

Section `Quyền & lưu trữ` nằm trong child OS window Hồ sơ hành chính hiện hữu. Cửa sổ vẫn dùng stable Staff identity, rộng/maximized, có minimize/maximize/close và taskbar đầy đủ. Title/taskbar không chứa policy, audit, reason note, document metadata hoặc sensitive values.

Window chỉ có một `.staff-administrative-content-scroll`. Governance panels nằm trong normal document flow, không nested overflow/double-scroll. Audit filter refresh riêng results region; section mutation refresh riêng governance section, giữ main scroll/caret. Click đầu, native dropdown, keyboard và focus existing window không dùng timeout hay focus workaround.

Center switch đóng/reset child window và xóa in-memory request selection/reveal state. Mọi storage read/write lấy current center key động; mismatched center hoặc orphan Staff/Profile relationship khóa mutation. Không giữ audit của center A trong DOM center B.

## Staff/Profile/Documents compatibility

Governance không gọi Staff save, profile save hoặc document save:

- không đổi employment status/end date/lifecycle/archive/department;
- không đổi Teacher/account/membership links;
- không đổi profile completion/revision/updatedAt chỉ vì audit/request/policy;
- không đổi document expiry status, revision hoặc archive state;
- không tạo attachment giả và không mutate attachment metadata.

Profile/document nghiệp vụ chỉ thay đổi bởi action riêng của phase B/C. F23.11D nối audit sau các action thành công nhưng không đưa governance state vào source-of-truth records.

## No-binary và private URL

Ba entity governance chỉ chứa metadata nhỏ. Validator fail closed với binary/blob/file-like object, ArrayBuffer, base64/data URL, object URL, storage path/bucket và signed/public URL trong unknown payload. Không có file input, upload CTA, preview hoặc attachment executor. Không lưu binary/base64/Blob/File/file lớn trong localStorage.

## Sensitive logging và HTML safety

Governance runtime không console-log profile, documents, request note, audit collection, membership object/token hoặc attachment metadata. Toast/message chỉ là chuỗi generic. Staff list/search/taskbar không nhận audit, policy, request hoặc raw sensitive values.

Reason/review note và mọi label đều escape ở render boundary. Test payload HTML hiển thị như text. Audit UI không có raw ID search; filter chỉ dùng action/outcome allowlist.

## Migration và backward compatibility

- Không tạo migration hoặc bulk rewrite.
- Center chưa có key mới tiếp tục với empty state và không tạo key khi chỉ đọc.
- JSON/record malformed được giữ nguyên, không remove/rewrite; mutation bị khóa.
- Unknown fields hợp lệ được preserve qua policy update và request transition.
- Existing F23.11B/B.1/B.2/C profile/documents không bị migrate.
- Audit append logic giữ event cũ và không cung cấp edit/delete.
- Future schema/status không được tự suy diễn thành đã thực thi.

Backend migration sau này phải đưa canonical membership ID, trusted audit sink, RLS, legal hold, idempotent execution, rollback/reconciliation và evidence vào một contract riêng.

## Automated tests

Smoke test `tests/f23-11d-quyen-truy-cap-audit-retention-va-quy-trinh-xoa-du-lieu-local-safe-smoke.js` bao phủ action matrix, inactive/malformed/wrong-center deny, audit allowlist/redaction/append-only/limit, policy validation/unknown-field/revision, all derived statuses, request scope/reason/status, cancel/approve/deny/separation, execution-pending, HTML escape, storage isolation/malformed preservation, one-scroll integration, no-binary/private-URL and source scans.

Regression chạy lại F23.11C/B/B.1/B.2 và F23.10B–E. Historical smoke nào có assertion source-marker quá cũ sẽ được báo riêng, không che lỗi runtime mới.

## Manual QA

Fixture: ít nhất hai active Owner khác membership, một active center_admin, teacher, consultant, một Staff active và một Staff terminated có end date; mỗi Staff có profile/documents.

1. Owner mở `Hồ sơ hành chính → Quyền & lưu trữ`; xác nhận window/taskbar/focus và đúng một content scroll.
2. Xác nhận owner thấy policy editor; admin chỉ thấy derived status; teacher/consultant/inactive không thấy sensitive window.
3. Tạo policy 1825/1825/30, reload và xác nhận persistence + audit policy event.
4. Kiểm tra active Staff là `Không áp dụng`; terminated Staff lần lượt `Đang lưu trữ`, `Sắp đến hạn rà soát`, `Đến hạn rà soát` theo dates.
5. Admin tạo request với reason hợp lệ, reload và xác nhận profile completion/document revision/Staff lifecycle không đổi.
6. Admin cancel own pending; xác nhận admin khác không cancel và audit có event.
7. Owner tạo request rồi thử tự approve/deny; xác nhận `Cần một Owner khác phê duyệt`.
8. Owner thứ hai deny một request; request được giữ, HTML note escape và audit không chứa note.
9. Owner thứ hai approve request khác; xác nhận `Chờ thực thi backend`, execution eligible date và dữ liệu vẫn còn sau reload.
10. Mô phỏng stale revision/double click, malformed storage và center switch; xác nhận không overwrite, không cross-center DOM/storage.
11. Reveal từng sensitive field; xác nhận event chỉ có canonical field key và mask/reveal lifecycle F23.11B.2 vẫn đúng.
12. Filter audit, `Xem thêm`, close/reopen/minimize/maximize; xác nhận first click/caret/scroll/taskbar ổn định.

Manual QA chưa được tự động kết luận PASS. Automated verification không thay thế kiểm thử browser với nhiều membership thật.

## Roadmap

Sau khi manual QA pass:

```text
F23.11D DONE public / Quyền theo action, audit append-only, retention và deletion-request local-safe
F23.11E NEXT backend / Upload ảnh-PDF tài liệu nhân sự bằng Supabase Storage private
```

F23.11E Supabase attachment roadmap phải dùng private bucket, RLS theo center/action, short-lived access, malware/content validation, size/MIME allowlist, attachment audit, orphan reconciliation và không persist access URL.

Future backend deletion execution là phase riêng: trusted worker kiểm separation/approval/grace/legal hold/latest revision, thực thi idempotent theo exact scope, ghi immutable evidence và có retry/reconciliation. F23.11D không tự bắt đầu F23.11E, không tạo migration và không deploy.

STAFF ADMINISTRATIVE GOVERNANCE COMPLETE - AWAITING MANUAL QA
