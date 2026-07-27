# F23.11A - Design Hồ sơ hành chính Nhân viên và tài liệu nhân sự

F23.11A STATUS: DESIGN ONLY
RUNTIME_CHANGED: NO
DATA_MIGRATION_CREATED_OR_RUN: NO
AUTH_SUPABASE_SQL_DEPLOY_CHANGED: NO
CANONICAL_PROFILE_ENTITY: centerStaffAdministrativeProfiles
CANONICAL_DOCUMENT_ENTITY: centerStaffDocuments
CANONICAL_ATTACHMENT_METADATA_ENTITY: centerStaffDocumentAttachments
CANONICAL_STAFF_LINK: staffMemberId
PROFILE_CARDINALITY: ONE_STAFF_TO_ZERO_OR_ONE_PROFILE
BINARY_IN_LOCAL_STORAGE: NO
PRIVATE_ATTACHMENT_READY: YES
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Phạm vi và quyết định tổng quát

F23.11A chỉ chốt thiết kế. Phase này không sửa runtime, không tạo record local, không upload file, không tạo migration/bucket/policy, không thay Auth hoặc membership và không deploy.

Quyết định canonical:

- `centerStaffMembers` tiếp tục là hồ sơ vận hành nhân viên.
- `centerStaffAdministrativeProfiles` là hồ sơ hành chính riêng, optional, center-scoped, liên kết một-một bằng stable `staffMemberId`.
- `centerStaffDocuments` là metadata tài liệu một-nhiều của nhân viên.
- `centerStaffDocumentAttachments` là metadata attachment tách khỏi document và binary.
- Không copy dữ liệu vận hành, role, account, hồ sơ giảng dạy hoặc lifecycle vào hồ sơ hành chính.
- Không dùng tên, mã nhân viên, email, số điện thoại, số giấy tờ hoặc số tài khoản làm khóa liên kết.
- Hồ sơ hành chính mở trong một OS child window riêng của Module Nhân viên; không biến form `Sửa hồ sơ nhân viên` thành form dài.
- Local storage chỉ chứa JSON metadata nhỏ. Binary, base64, Blob, `File`, object URL và signed URL không được persist.
- Surface mới fail closed: chỉ active membership đúng current center và role được phép mới mở được. Client guard không thay thế authorization/RLS của mô hình cloud tương lai.

## 2. Audit nền tảng thực tế

### 2.1 `centerStaffMembers`

Nguồn đã đọc: `src/storage.js`, `src/staff-module.js`, `src/main.js` và docs F23.10A-E.

Storage key hiện tại là `ichessCenterOS.centerStaffMembers.<centerId>`, được tạo qua `createCenterScopedStorageKey`. Khi current center được resolve lại, app reload staff/departments và reset form, panel, link state, lifecycle state liên quan.

Schema runtime hiện được normalizer quản lý:

```js
{
  id,
  centerId,
  employeeCode,
  fullName,
  phone,
  email,
  departmentId,
  positionTitle,
  employmentType,
  employmentStatus,
  startDate,
  endDate,
  teacherId,
  accountUserId,
  membershipId,
  accountLinkedAt,
  employmentLifecycleEvents,
  note,
  createdAt,
  updatedAt,
  archivedAt,
  ...unknownFields
}
```

Các contract thực tế:

- `id` là stable staff ID; create helper sinh `staff-...`. Đây là `staffMemberId` duy nhất được dùng ở F23.11.
- `centerId` explicit trong record và key local cũng center-scoped. Save/link/lifecycle/archive đều đọc latest record và chặn explicit cross-center.
- `employeeCode` optional nhưng nếu có thì unique case-insensitive trong center; archived record vẫn chặn duplicate.
- `fullName` là tên hiển thị vận hành. `phone` và `email` là liên hệ vận hành/công việc.
- `departmentId`, `positionTitle`, `employmentType` là metadata vận hành, không cấp quyền hệ thống.
- `employmentType` hiện gồm `unspecified`, `full-time`, `part-time`, `collaborator`, `contract`.
- `employmentStatus` canonical chỉ gồm `active`, `on-leave`, `terminated`. `startDate` optional; `endDate` chỉ persist cho `terminated`.
- `teacherId` là link một chiều tới hồ sơ chuyên môn; teacher record không có backlink staff canonical.
- Account link canonical là cặp `accountUserId` + `membershipId`; `accountLinkedAt` chỉ là metadata thời điểm. Role/email/status không được copy làm source of truth.
- `note` hiện thuộc staff operational record. Ghi chú hành chính mới phải dùng field `note` của administrative profile và label rõ để không trộn nguồn.
- `buildStaffMemberFromForm` spread latest record trước rồi override field thuộc form, do đó giữ stable ID, link, history và unknown fields.

### 2.2 Lifecycle, history và archive

- `employmentLifecycleEvents` là mảng append-only gồm stable event ID, `fromStatus`, `toStatus`, `effectiveDate`, `note`, `createdAt`, `createdBy`, `createdByLabel`.
- Transition hợp lệ: `active → on-leave|terminated`, `on-leave → active|terminated`, `terminated → active`.
- Save lifecycle có double-submit guard, latest unique-ID guard, current-center guard và stale signature gồm status, `archivedAt` và toàn bộ history.
- Archive hiện chỉ đặt `archivedAt` và giữ nguyên employment status, end date, history, teacher/account links cùng unknown fields. Archive không append termination event và không cascade.
- Restore chỉ clear `archivedAt`; status, history và links được giữ.
- Legacy `employmentStatus: archived` được đọc tương thích thành archive state riêng, không tạo event suy đoán.

Hệ quả cho F23.11: staff archive/restore không được thay đổi, archive, xóa hoặc chuyển ownership profile/document/attachment. Administrative profile có lifecycle riêng và luôn resolve qua stable staff ID cũ.

### 2.3 Account, membership, role và current center

- Auth `user.id` là account identity. `center_members.id` là membership identity; `center_members.role` là role source of truth.
- Role runtime đã thấy gồm `owner`, `qtv`, `admin`/`center_admin`, `teacher`, `consultant`, `viewer`. Alias `admin` được normalize về `center_admin` trong access layer.
- Membership vocabulary đang đọc gồm `active`, `revoked`, `paused` và legacy/read-only values `inactive`, `suspended`, `disabled`. Chỉ `active` cấp current access/link mới.
- `resolveActiveCenterMembership` đọc các membership của user; không có active row thì trả denied reason riêng cho revoked, paused hoặc no membership. Current center binding chỉ `bound` khi có active membership và center ID.
- Khi có nhiều active center, runtime hiện chọn row đầu theo thứ tự `center_id`; vì vậy cửa sổ nhạy cảm phải capture chính xác center tại lúc mở và không được dựa vào fallback center.
- Staff account directory đọc current-center rows theo stable IDs. Account status của user khác thường là `unknown`; không được suy đoán Auth ban/lock state.
- Account lifecycle C7.9 hiện có create/reset/revoke/restore cho `center_admin` trong owner console. Revoke là đổi membership center-scoped, không disable Auth user toàn cục; revoked state có thể được list lại sau reload. Deep-open hiện chỉ an toàn cho `center_admin` và actor owner.
- Online access chung hiện cho teacher/consultant đọc cloud ở mức nền tảng. Điều đó không cấp quyền đọc hồ sơ hành chính; surface F23.11 phải có policy riêng và deny-by-default.

### 2.4 Transaction attachment foundation hiện có

Nguồn đã đọc: `src/transaction-attachments.js`, `src/supabase-storage.js`, `src/image-compression.js`, cashflow runtime và policy hiện có.

Foundation thực tế:

- Metadata table hiện có các field center, transaction code/date/month, amount/type/note, original/stored filename, MIME, size, bucket/path, uploader và created time.
- Bucket `transaction-images` được policy hiện có đặt private. Metadata và storage object đều kiểm tra active membership cùng center và role `owner` hoặc `center_admin`.
- Object path hiện tại là `<centerId>/transaction-images/<year>/<month>/<fileName>`.
- Helper có list theo month/transaction, create/update/delete metadata, upload object, delete object và tạo signed URL.
- Signed URL mặc định sống một giờ, chỉ dùng runtime; metadata canonical không chứa signed URL.
- Source file allowlist là JPEG/PNG/WebP, tối đa 10 MiB; client nén về JPEG, tối đa 1920 px. Uploader cloud chỉ nhận JPEG đã nén và `upsert: false`.
- Transaction form mới yêu cầu cloud context hợp lệ để upload. Legacy `transaction.attachment.dataUrl` tối đa 1 MiB vẫn được đọc để backward compatibility.
- Delete manager xóa storage object rồi xóa metadata; replace có cleanup object cũ sau khi transaction save.

Không tái sử dụng contract này trực tiếp vì nó gắn với giao dịch/tháng/số tiền, image-only, có legacy base64 local, filename nghiệp vụ, signed URL TTL dài hơn nhu cầu HR và delete semantics không phù hợp retention. F23.11 chỉ reuse các nguyên tắc tốt: private bucket, live membership check, same-center path guard, metadata tách binary, short-lived signed URL và cleanup có kiểm soát.

### 2.5 UI/window/focus patterns

- OS shell quản lý `openWindows`, z-index, taskbar, minimize, maximize, close, focus và drag. Child window chi tiết có thể có `type` + stable entity ID, mở maximized và focus lại instance hiện có.
- Staff edit hiện là overlay gần full viewport; chính `.staff-form` là scroll container. Lifecycle/account lại là child modal trên form, nên không phù hợp để nhét thêm hồ sơ dài.
- Tuition full-window panel, student child window, image manager và cloud gallery chứng minh các pattern header cố định + body scroll hoặc OS child window riêng.
- Transaction image viewer chỉ resolve signed URL khi user mở; list không fetch signed URLs hàng loạt.
- Focus/caret guard hiện có: không full render theo mỗi text input, defer render khi đang edit text, `focus({ preventScroll: true })`, keyed scroll restoration qua `data-preserve-scroll-key`, scoped action markers và request token để bỏ response stale.

F23.11B phải giữ các invariants này: input chỉ cập nhật draft/validation tại chỗ, native controls giữ interaction, không timeout/pointer hack, không full render mỗi phím và không để modal cha/con cạnh tranh scroll.

## 3. Ranh giới source of truth

| Dữ liệu | Source of truth | Không được làm |
| --- | --- | --- |
| Mã nhân viên, tên hiển thị | `centerStaffMembers` | Không copy sang profile để đồng bộ hai chiều |
| Điện thoại/email công việc | `centerStaffMembers` | Không duplicate trong profile nếu không có mục đích khác |
| Phòng ban, chức danh, loại hình làm việc | `centerStaffMembers` | Không dùng cấp quyền hồ sơ hành chính |
| Trạng thái làm việc, start/end date, lifecycle history | `centerStaffMembers` | Contract metadata không được tự đổi lifecycle |
| Link hồ sơ chuyên môn/account/membership | `centerStaffMembers` + source liên quan | Không copy role/status vào profile |
| Archive staff | `centerStaffMembers.archivedAt` | Không cascade profile/document/attachment |
| Họ tên theo giấy tờ, ngày sinh, địa chỉ, liên hệ khẩn cấp | Administrative profile | Không overwrite staff display name/contact |
| Identity/tax/insurance/bank/contract metadata | Administrative profile | Không dùng định danh người hoặc account matching |
| Tài liệu nhân sự | `centerStaffDocuments` | Không nhét file/reference list vào staff record |
| File và trạng thái storage | `centerStaffDocumentAttachments` + private object storage | Không lưu binary hay URL truy cập trong profile/document |

`centerStaffMembers.fullName` và `legalFullName` có thể khác. Create profile lần đầu được prefill `legalFullName` vào draft từ `fullName`, nhưng không auto-save. Sau create không sync hai chiều và sửa legal name không đổi staff display name.

F23.11B không thêm personal email. Nếu phase sau chứng minh mục đích riêng, field phải có label `Email cá nhân`, không dùng làm login/account link và không thay staff work email.

## 4. Cardinality, ownership và invariant

Quan hệ MVP:

```txt
centerStaffMembers (1)
  └── centerStaffAdministrativeProfiles (0..1)
        └── centerStaffDocuments (0..n)
              └── centerStaffDocumentAttachments (0..10 mỗi document)
```

Invariants bắt buộc:

1. Profile phải resolve đúng một staff cùng `centerId`; profile orphan/cross-center không được mở hoặc save.
2. Trong một center không được có hai profile cùng `staffMemberId`. Duplicate là `NEEDS REVIEW`, không chọn bản mới nhất và không auto-merge.
3. `id`, `centerId`, `staffMemberId`, `createdAt` bất biến sau create.
4. Document phải cùng center/staff/profile; attachment phải cùng center/staff/profile/document.
5. Employee code, tên, email hoặc phone đổi không thay ownership.
6. Staff archive/restore giữ nguyên link. Profile archive không archive staff.
7. Document/attachment không được tồn tại độc lập nếu chain stable IDs không resolve; malformed data được giữ để review, không silently relink.

## 5. Phân loại dữ liệu và data minimization

Ba lớp dữ liệu đều là dữ liệu nội bộ, không public:

- Nhóm A - hành chính cơ bản/restricted: legal name, ngày sinh, quốc tịch, địa chỉ, liên hệ khẩn cấp, completion/review metadata. Chỉ owner/center_admin đúng center.
- Nhóm B - nhạy cảm/highly restricted: số giấy tờ, thuế, bảo hiểm, ngân hàng, hợp đồng và mọi free-text có thể chứa các giá trị này. Mask mặc định, không list/search/log raw.
- Nhóm C - tài liệu/attachment/highest handling: giấy tờ tùy thân, hợp đồng, phụ lục, CV, bằng cấp/chứng chỉ, bảo hiểm, quyết định, bàn giao và file khác. Private storage, access theo từng action, không URL public.

Không field Group B nào là điều kiện tạo staff hoặc profile. Profile có thể incomplete và mọi object nhạy cảm có thể rỗng. Không thu thập giới tính ở UI F23.11B vì chưa có mục đích nghiệp vụ được chứng minh; schema reserve field optional và normalizer preserve dữ liệu future/imported. Không đưa dữ liệu lương/chấm công vào F23.11.

## 6. Canonical Administrative Profile schema

```js
{
  ...unknownFields,
  id,                       // stable admin-profile-...
  schemaVersion,            // 1
  centerId,
  staffMemberId,

  legalFullName,
  dateOfBirth,
  gender,                   // reserved; UI B không thu thập
  nationality,

  permanentAddress: {
    ...unknownFields,
    addressLine,
    wardOrCommune,
    district,
    provinceOrCity,
    country,
  },
  currentAddress: {
    ...unknownFields,
    addressLine,
    wardOrCommune,
    district,
    provinceOrCity,
    country,
  },
  emergencyContact: {
    ...unknownFields,
    name,
    phone,
    relationship,
  },

  identityDocument: {
    ...unknownFields,
    type,
    number,
    issuedDate,
    issuedPlace,
    expiryDate,
  },
  taxInformation: {
    ...unknownFields,
    taxNumber,
    registeredDate,
    registeredPlace,
  },
  insuranceInformation: {
    ...unknownFields,
    socialInsuranceNumber,
    healthInsuranceNumber,
  },
  bankInformation: {
    ...unknownFields,
    bankName,
    accountNumber,
    accountHolderName,
    branch,
  },
  employmentAdministration: {
    ...unknownFields,
    contractNumber,
    contractType,
    signedDate,
    effectiveDate,
    expiryDate,
    signingEntity,
    note,
  },

  note,
  completionStatus,         // incomplete | complete | needs-review
  completionReview: {
    ...unknownFields,
    reviewedAt,
    reviewedBy,
    reviewedByLabel,
    checklistVersion,
  },
  createdAt,
  updatedAt,
  archivedAt,
  revision,
}
```

`not-created` là derived state khi không có profile; `archived` là derived state khi `archivedAt` có giá trị. Hai state này không được lưu vào `completionStatus`, tránh hai nguồn lifecycle mâu thuẫn.

### 6.1 Required, validation, access và retention theo field

| Field/nhóm | Mục đích | Nhóm | Required | Validation/normalization | View | Retention |
| --- | --- | --- | --- | --- | --- | --- |
| `id`, `schemaVersion` | Identity/schema | A | Record required | ID sinh lúc create, không đổi; version = 1 | owner/admin | Cùng profile |
| `centerId`, `staffMemberId` | Scope và one-to-one | A | Record required | Trim; resolve exact same-center; immutable | owner/admin | Cùng profile |
| `legalFullName` | Tên pháp lý | A | Optional khi save; required để complete | Unicode, trim ngoài, 1-200 ký tự | owner/admin | Cùng profile |
| `dateOfBirth` | Hành chính nhân sự | A | Optional; required để complete | Real `YYYY-MM-DD`, không sau hôm nay | owner/admin | Cùng profile |
| `gender` | Reserved future | A | Optional; UI B không hỏi | Empty hoặc enum được phase sau phê duyệt | owner/admin | Cùng profile |
| `nationality` | Quốc tịch | A | Optional | Trim ngoài, tối đa 100 | owner/admin | Cùng profile |
| Hai address object | Địa chỉ hành chính | A | Partial save được; current address required để complete | Mỗi field text, trim ngoài; mỗi field tối đa 300; không tự viết hoa/đổi dấu | owner/admin | Cùng profile |
| `emergencyContact` | Liên hệ khi khẩn cấp | A | Partial save được; name/phone/relationship required để complete | Phone text 6-30, format mềm; không cast number | owner/admin | Cùng profile |
| `identityDocument` | Metadata giấy tờ | B | Optional | Type enum mở rộng; number text 1-64; issued <= expiry; issued không sau hôm nay | masked owner/admin | Cùng profile, không dùng làm key |
| `taxInformation` | Kê khai thuế | B | Optional | Number text 1-64; giữ leading zero; date hợp lệ | masked owner/admin | Cùng profile |
| `insuranceInformation` | Theo dõi bảo hiểm | B | Optional | Các number là text 1-64, không regex quốc gia quá chặt | masked owner/admin | Cùng profile |
| `bankInformation` | Thanh toán hành chính | B | Optional | Account number text 1-64; bank/holder tối đa 200; không cast number | masked owner/admin | Cùng profile |
| `employmentAdministration` | Metadata hợp đồng | B | Optional | Number/type/entity text; effective <= expiry; không đổi staff lifecycle | masked owner/admin | Cùng profile/document policy |
| `note` và contract `note` | Bối cảnh hành chính | B theo worst case | Optional | Trim ngoài; tối đa 2.000; không đưa vào log/search chung | owner/admin | Cùng profile |
| `completionStatus/review` | Workflow chất lượng | A | Required | Enum; review actor/time/checklist coherent | owner/admin | Cùng profile/audit |
| Timestamps, `archivedAt`, `revision` | Lifecycle/concurrency | A | Required trừ `archivedAt` | ISO datetime; revision integer >= 1, tăng đúng 1 mỗi save | owner/admin | Cùng profile/audit |

Không sửa nội dung pháp lý bằng lower-case, upper-case, bỏ dấu, number coercion hoặc regex Việt Nam bắt buộc. Chỉ trim outer whitespace; value rỗng canonical là `''`. Date invalid không được silently đổi thành hôm nay.

### 6.2 Completion rules

- Create record đầu tiên luôn `incomplete`, kể cả draft prefill đã đủ.
- Checklist v1 để được đánh dấu `complete`: `legalFullName`, `dateOfBirth`, current address có ít nhất `addressLine` + `provinceOrCity`, và emergency contact đủ name/phone/relationship.
- Owner hoặc center_admin phải bấm explicit `Đánh dấu đã kiểm tra`; khi đó set `complete` và ghi `completionReview` với checklist version.
- Thay đổi bất kỳ field checklist hoặc Group B sau review tự chuyển `complete → needs-review`, clear review approval cũ nhưng giữ audit event future.
- `needs-review` không cấp hay rút quyền. Admin có thể save partial correction rồi review lại.
- Archive profile không sửa persisted completion status; UI derived là `archived`.

### 6.3 Normalizer và stale-write contract

- Tách normalized read model khỏi persisted raw data; không auto-save normalized sensitive records chỉ vì app load.
- Chỉ nhận plain object. Record thiếu stable ID/staff link hoặc có explicit center mismatch được quarantine/read-only và báo review; normalizer không sinh ID thay thế hoặc đổi owner.
- Record thiếu `centerId` chỉ có thể được coi thuộc center của chính storage namespace nơi nó được đọc; explicit center khác không được overwrite.
- Spread unknown fields ở record và từng nested object trước khi override owned fields.
- Nested value malformed không được silently thay bằng `{}` rồi ghi lại. Section bị khóa save cho đến khi user explicit sửa/clear; raw value vẫn được preserve.
- Không log record, nested object, identity/bank/tax/insurance number hoặc note.
- Create sinh ID một lần; edit latest-read theo profile ID và yêu cầu đúng một match.
- Save capture `{centerId, staffMemberId, profileId, revision, updatedAt}`; ngay trước write đọc latest storage, kiểm tra one-to-one/center/staff/archive và so revision + updatedAt. Pass thì replace đúng một record, tăng revision, cập nhật timestamp. Fail thì không merge mù quáng.
- Double-submit guard theo profile window. Không autosave từng field.

## 7. Canonical Document schema

```js
{
  ...unknownFields,
  id,                       // stable staff-document-...
  schemaVersion,            // 1
  centerId,
  staffMemberId,
  administrativeProfileId,

  category,
  title,
  documentNumber,
  issuedDate,
  effectiveDate,
  expiryDate,
  validityMode,             // expires | no-expiry | not-applicable
  recordStatus,             // draft | verified | superseded
  supersededByDocumentId,
  note,

  attachmentIds,
  createdAt,
  updatedAt,
  archivedAt,
  revision,
}
```

MVP categories: `identity`, `employment-contract`, `contract-appendix`, `cv`, `degree`, `certificate`, `insurance`, `decision`, `handover`, `other`. Category là taxonomy, không phải authorization. Label có thể localize; stored value ổn định. Custom category chỉ mở sau khi có category registry, không dùng free text làm role rule.

`title` là business-required, 1-200 ký tự. `documentNumber` optional text 1-120 và masked theo category/policy. Date phải là real `YYYY-MM-DD`; issued/effective không sau expiry nếu các cặp cùng có giá trị. `attachmentIds` là array stable ID unique, tối đa 10; binary không nằm trong record.

Validity hiển thị là derived mỗi lần đọc:

1. Có `archivedAt` → `Đã lưu trữ`.
2. `validityMode = not-applicable` → `Không áp dụng`.
3. `validityMode = no-expiry` hoặc không có expiry hợp lệ → `Không hết hạn`.
4. `expiryDate < today` → `Đã hết hạn`.
5. `today <= expiryDate <= today + 30 ngày` → `Sắp hết hạn`.
6. Còn lại → `Còn hiệu lực`.

Derived validity không được persist vào `recordStatus`. F23.11A/C không tạo notification automation.

## 8. Canonical Attachment metadata schema và private storage

```js
{
  ...unknownFields,
  id,                       // stable staff-attachment-...
  schemaVersion,            // 1
  centerId,
  staffMemberId,
  administrativeProfileId,
  documentId,

  originalName,
  storedName,
  mimeType,
  sizeBytes,
  sha256,
  storageProvider,
  storageBucket,
  storagePath,
  attachmentState,          // metadata-only | pending-upload | available | quarantined | archived | missing
  scanStatus,               // not-scanned | pending | clean | blocked | failed
  version,
  replacesAttachmentId,

  uploadedAt,
  uploadedBy,
  createdAt,
  updatedAt,
  archivedAt,
  revision,
}
```

Local-safe rules:

- F23.11B không tạo attachment records.
- F23.11C có thể persist metadata/draft state nhỏ, nhưng không persist raw `File`, Blob, ArrayBuffer, base64/data URL, object URL, signed URL, preview bytes hoặc PDF/image content.
- `metadata-only` cho phép nhập catalog document chưa có file; không giả vờ file đã upload.
- `storagePath` là private opaque locator, không render/copy ra UI thường. `storageBucket` không đồng nghĩa public.
- Signed URL được tạo on-demand sau live authorization, TTL tối đa 5 phút, giữ trong memory của viewer, không log/persist và clear khi close/center switch. Không permanent public URL.

Private object path v1:

```txt
<centerId>/staff/<staffMemberId>/documents/<documentId>/attachments/<attachmentId>/<storedName>
```

Mọi segment identity lấy từ stable IDs; `storedName` là opaque generated filename, không chứa tên người, employee code, document number hoặc original filename. Bucket tương lai riêng cho staff documents và phải private; không reuse `transaction-images`.

Authorization chain tương lai:

```txt
auth user
→ active membership của captured current center
→ role/action được phép
→ profile/document/attachment cùng center
→ stable ownership chain resolve duy nhất
→ storage object path cùng center và IDs
```

Client validation và UI hidden không thay thế metadata RLS + storage object policy.

### 8.1 File policy v1

- Allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- Reject: executable, archive, script, HTML, XML, SVG/active content, office macro file và unknown MIME.
- Kiểm tra đồng thời extension, declared MIME, magic bytes/server sniffing; mismatch bị reject/quarantine.
- Max 10 MiB mỗi file, tối đa 10 attachment mỗi document, tổng tối đa 50 MiB mỗi document. Không tự nén/re-encode tài liệu pháp lý làm mất bản gốc; image thumbnail là derivative tách riêng nếu phase sau cần.
- Image preview và PDF open/download chỉ qua guarded viewer. PDF không auto-embed trên list; download là explicit action.
- Upload mới dùng `upsert: false`. Replace tạo attachment ID/version mới, upload + metadata thành công trước, rồi archive bản cũ và set `replacesAttachmentId`; failure giữ bản cũ available.
- Archive không xóa object. Permanent object cleanup chỉ thuộc deletion workflow đã qua retention/dependency/audit.
- `scanStatus` chuẩn bị cho malware scanning. Khi backend chưa scan được, UI nói rõ `Chưa quét`; không gọi là safe. `blocked/failed/quarantined` không preview/download.

## 9. Access matrix và privacy-by-design

Mọi permission dưới đây yêu cầu active membership, captured current center khớp local namespace và entity chain cùng center. Position/department/staff account link không cấp quyền.

| Action | owner | center_admin | teacher | consultant |
| --- | --- | --- | --- | --- |
| Xem completion status trên Staff list | Có, current center | Có, current center | Không | Không; chỉ operational data nếu module khác cho phép |
| Mở/xem Group A | Có | Có | Không, kể cả hồ sơ người khác | Không |
| Xem Group B masked | Có | Có | Không | Không |
| Reveal/copy Group B | Có, explicit + audit D | Có, explicit + audit D | Không | Không |
| Create/edit/review profile | Có | Có | Không | Không |
| Archive/restore profile | Có | Có, confirmation | Không | Không |
| List/add/edit/archive document metadata | Có | Có | Không | Không |
| Upload/preview/download/replace/archive file | Có | Có, confirmation + audit | Không | Không |
| Gửi deletion request | Có | Có | Không | Không |
| Approve permanent deletion/retention override | Owner only trong D | Không | Không | Không |
| Print/export redacted | Theo policy D | Theo policy D | Không | Không |

`admin` alias được đối xử như `center_admin`. Các role `qtv`, `viewer`, unknown hoặc role mới bị deny cho surface này cho đến khi policy explicit được phê duyệt; không kế thừa quyền cloud chung.

F23.11B phải có coarse surface gate owner/center_admin để không đưa dữ liệu nhạy cảm vào UI của role khác. F23.11D hoàn thiện field/action enforcement, audit và cloud policy. Nếu không resolve được active membership hoặc app offline/membership stale, sensitive window fail closed; staff operational module vẫn theo policy riêng.

Field privacy:

- Identity, bank, insurance và tax number mask tất cả trừ tối đa 4 ký tự cuối; value ngắn vẫn không hiện toàn bộ.
- Contract/document number masked theo category. Staff list không render các field Group B/C.
- Reveal từng field, không `Reveal all`; state chỉ in-memory, reset khi close/minimize timeout policy/center switch và không lưu.
- Copy là action riêng, không copy bằng click text; D ghi audit event nhưng không ghi clipboard value.
- Không index global search theo identity/tax/insurance/bank/document number, address hoặc note. Document search chỉ ở guarded window và mặc định theo category/title/expiry.
- Print/export không mặc định tồn tại ở B/C. D yêu cầu chọn section, redact Group B, exclude attachments mặc định và audit action.
- Notification/list/log/error không chứa raw sensitive value, original file content, storage path hoặc signed URL.

## 10. UI decision

Chọn OS child window, không chọn modal lồng và không tạo public launcher/module mới.

Window contract tương lai:

- `type = staff-administrative-profile`, key duy nhất `centerId + staffMemberId`.
- Action `Mở hồ sơ hành chính` đặt ở Staff detail/edit surface và row action phù hợp; action chỉ truyền stable staff ID.
- Reopen cùng staff/current center focus instance hiện có; không tạo duplicate window.
- Mở maximized; restore bounds tối thiểu khoảng 1.000 × 680 khi viewport cho phép. Có titlebar/taskbar/minimize/maximize/close theo OS shell hiện tại.
- Header hiển thị operational employee code/display name read-only từ latest staff; không snapshot vào profile.
- `.window-body` của loại window này `overflow: hidden`. Layout gồm header/action bar, left section navigation và đúng một `.staff-administrative-content-scroll` là vertical scroll owner.
- Left navigation không có scroll độc lập ở desktop; sticky trong layout. Mobile/narrow chuyển thành horizontal section picker ở header, vẫn chỉ content body scroll.
- Section: Tổng quan, Thông tin cá nhân, Địa chỉ và liên hệ khẩn cấp, Giấy tờ, Thuế/bảo hiểm, Ngân hàng, Hợp đồng, Tài liệu, Lịch sử. F23.11B section Tài liệu/Lịch sử có roadmap empty state.
- Section navigation đổi anchor trong một content document; không tabs dựng nhiều nested scroll pane.
- Attachment viewer là OS child viewer riêng hoặc guarded top-level viewer, không nhét PDF/image scroll vào profile scroll.

Create flow:

1. Resolve latest unique staff theo stable ID và current center.
2. Kiểm tra access. Nếu chưa có profile, show empty state; không auto-create khi mở.
3. `Tạo hồ sơ hành chính` tạo draft với captured center/staff ID, legal name prefill từ latest staff name và chưa persist.
4. Explicit save kiểm tra center, staff tồn tại duy nhất, one-to-one latest, revision/create collision và double-submit.
5. Save đúng một profile rồi mở review state `incomplete`; không copy teacher/account data.

Edit flow:

- Load latest profile theo profile ID + stable staff ID; preserve unknown fields/nested objects/doc links.
- Save explicit, replace đúng một record, không append duplicate, không sửa staff operational record/link/lifecycle.
- Center switch đóng mọi administrative/viewer window của center cũ, clear draft/reveal/object URL, invalidate async request token và không cross-write.
- Validation error giữ window/scroll/focus; focus field lỗi dùng `preventScroll` rồi chỉ scroll main content đủ để thấy field.
- Input/change cập nhật draft tại chỗ; không full app render mỗi keystroke, không mất caret/first click.

Staff list chỉ có badge derived: `Chưa tạo`, `Chưa hoàn thiện`, `Cần kiểm tra`, `Đã hoàn thiện`, `Đã lưu trữ`. Không render address, document number, account number, contract number, attachment count nhạy cảm hoặc expiry detail. Filter completion để phase sau, không đưa sensitive search vào global list.

## 11. Archive, retention, deletion và audit

Phân biệt bốn khái niệm:

- Archive: reversible visibility/lifecycle flag; giữ metadata, link và object.
- Retention: thời gian/hold quyết định record có được xét deletion hay chưa; không đồng nghĩa archive.
- Deletion request: workflow có requester, reason, dependency scan, policy/hold result, approver và confirmation.
- Permanent deletion: irreversible cleanup metadata + attachment object sau authorization/retention/audit; không có ở B/C.

MVP policy chốt:

- B/C chỉ archive/restore, không hard-delete và không auto-purge.
- Staff archive không đổi profile/document/attachment. Window vẫn mở read-only với banner `Nhân viên đã lưu trữ`; muốn sửa field phải restore staff trước. Document archive/retention action độc lập vẫn được xử lý ở phase policy phù hợp.
- Profile archive là explicit owner/admin action, set `archivedAt`, giữ persisted completion status và làm profile read-only. Restore clear `archivedAt` sau same-center/latest guard.
- Document/attachment archive là explicit và independent; replace archive version cũ nhưng không xóa binary.
- Default khi chưa có center retention policy được phê duyệt là `deletion blocked - policy missing`; dữ liệu archived được giữ, không silently expire. D mới thêm policy/category hold và eligibility workflow.
- `endDate`, termination hoặc expired document không tự xóa/archive profile/file.

Audit future-ready dùng entity riêng append-only `centerStaffAdministrativeAuditEvents`, không dùng `revision` thay audit. Event tối thiểu có stable ID, center/staff/profile/document/attachment IDs khi applicable, action, section names changed, actor user/membership IDs, timestamp, request/correlation ID và redaction flag. Actions gồm create/review/archive/restore, sensitive section updated, document add/replace/archive, attachment upload/view/download/archive, reveal/copy, policy change và deletion workflow.

Audit tuyệt đối không chứa raw before/after Group B, note content, filename nếu nhạy cảm, storage path, signed URL, token hoặc file bytes. Copy nên là `Đã cập nhật thông tin ngân hàng`, không phải số tài khoản cũ/mới.

## 12. Storage keys, migration và backward compatibility

Theo convention hiện tại:

```txt
ichessCenterOS.centerStaffAdministrativeProfiles.<centerId>
ichessCenterOS.centerStaffDocuments.<centerId>
ichessCenterOS.centerStaffDocumentAttachments.<centerId>
```

- F23.11B chỉ tạo key profiles khi user save profile đầu tiên; không seed profile và không ghi empty data hàng loạt khi app load.
- F23.11C mới tạo document/attachment metadata keys khi có explicit action; không binary.
- Existing staff tiếp tục hoạt động khi không có profile; `not-created` là read join result.
- Không đổi staff IDs/schema, teacher/account/membership schema, lifecycle events hoặc historical operational data.
- Không auto-create profile từ existing staff, không bulk copy name/contact và không match legacy data bằng text.
- Rollback feature chỉ cần bỏ đọc ba key mới; staff, hồ sơ chuyên môn, schedule, attendance, cashflow và report không phụ thuộc profile.
- Nếu future cloud migration được phê duyệt, migrate metadata theo stable IDs, verify counts + one-to-one + center chain trước cutover, giữ local read compatibility trong một version window và không upload binary từ localStorage vì binary không tồn tại ở đó.

## 13. Roadmap F23.11B-D

### F23.11B - Administrative profile local-safe

- Thêm profile key/helper/schema v1 và non-destructive normalizer.
- One-to-one/same-center/stable-ID/create-edit-archive-restore/stale-revision/double-submit guards.
- OS child window riêng, một scroll chính, Staff badge summary.
- Group A và optional Group B metadata; không personal email/lương; không file upload.
- Coarse active owner/center_admin gate, mask mặc định, no sensitive global search/log/print.
- Completion checklist/review state và center-switch cleanup.

Exit: automated coverage cho invariants local + manual QA; chưa attachment, chưa hard delete.

### F23.11C - Documents và private attachment readiness

- Document/attachment metadata entities, categories, validity derived, archive/version/replace.
- Local metadata-only mode trước; binary vẫn không vào local storage.
- Nếu backend/private storage được phê duyệt riêng: private bucket/policies, stable object path, allowlist/limits, live authorization, short-lived viewer URL, image/PDF viewer, scan/quarantine readiness.
- Upload atomicity/cleanup, no public URL, no in-place overwrite, old version retained.

Exit: metadata and object authorization tests, failed upload/replace cleanup QA, no secret/path leak.

### F23.11D - Privacy enforcement, audit và data lifecycle

- Field/action-level reveal/copy/download enforcement và append-only audit.
- Center retention policy, legal/business hold, handover, deletion request, dependency scan, owner approval và attachment cleanup.
- Redacted selective print/export, attachments excluded by default.
- Cloud schema/RLS/storage policies only after a separate approved implementation plan; client UI remains defense-in-depth.
- Optional expiry reminder and self-service are separate opt-in scopes, not implied by this roadmap.

Exit: deny-by-default matrix proven for every role/action, audit redaction tests, retention/deletion recovery runbook and manual two-account/two-center QA.

## 14. Manual QA plan

### F23.11B

1. Existing staff list loads with `Chưa tạo`; no profile is auto-created and existing staff JSON is unchanged.
2. Owner/admin opens a staff profile; a teacher/consultant or inactive membership is denied without sensitive flash.
3. Create draft prefills legal name but storage stays unchanged until explicit save.
4. Save incomplete profile; verify one record, stable IDs, current center, revision 1 and staff record/link/history byte-equivalent.
5. Reopen/edit; verify legal name does not alter staff display name and phone/email are not duplicated.
6. Try duplicate profile, duplicated ID, orphan staff and cross-center record; verify blocked `Cần kiểm tra`, no auto-repair.
7. Open same profile twice/reopen action; verify OS focuses one window. Test minimize/maximize/taskbar/close.
8. Type/select/date with first click/keyboard, validation and stale error; caret/focus/one main scroll remain stable.
9. Change center while draft/reveal/request is active; old window closes, draft clears, stale response is discarded.
10. Archive staff; profile/doc data unchanged and window read-only. Restore staff; link remains. Archive/restore profile does not change staff lifecycle.
11. Inspect list/search/log/DOM: no raw Group B on staff list, no role leakage and no binary/base64/signed URL.

### F23.11C

1. Create multiple documents with stable IDs/categories and derived no-expiry/valid/30-day/expired states.
2. Attach allowed PDF/JPEG/PNG/WebP at boundary sizes; reject oversize, MIME mismatch, SVG/HTML/executable/unknown.
3. Confirm max 10 attachments and 50 MiB aggregate.
4. Verify path contains only captured center and stable IDs, no employee/name/document number.
5. Preview image/open PDF/download through live same-center authorization; URL expires/clears and is absent from storage/log.
6. Replace attachment; new version becomes available before old archives. Simulate upload/metadata failure; old stays intact and orphan cleanup is reported.
7. Archive document/attachment/staff independently; no object hard-delete or lifecycle cascade.
8. Simulate quarantined/missing object and center switch during signed URL request; no preview/cross-center write.

### F23.11D

1. Test complete matrix bằng các account owner, center_admin, teacher và consultant riêng ở cùng center lẫn khác center.
2. Reveal/copy/view/download each emits redacted audit event; audit contains no raw values/path/URL.
3. Print selected sections; Group B redacted and attachments excluded unless explicit authorized choice.
4. Retention policy missing blocks deletion. Hold/dependency blocks deletion. Authorized request/approval cleans exact metadata/object chain and records redacted outcome.
5. Revoked/paused membership loses access immediately; already open window clears sensitive DOM/state.

## 15. Definition of Ready

F23.11B ready because canonical entity, one-to-one relation, field ownership, schema, required/completion rules, classification, storage key, normalizer, revision guard, access floor, UI window, center switching and archive behavior are fixed above.

F23.11C ready because document/attachment schemas, categories, derived expiry, stable path, allowlist, size/count limits, preview/download, replace/archive, scanning states and no-binary-local rule are fixed above. Backend work still requires separate approval.

F23.11D ready because role/action matrix, masking/reveal/copy boundary, audit redaction, retention/archive/deletion distinctions, export redaction and future cloud authorization chain are fixed above.

## 16. Verification F23.11A

- Docs marker/content check: PASS (18 required markers/sections).
- `npm run build`: PASS; Vite chỉ báo non-blocking warning về bundle chunk lớn hơn 500 kB.
- `git diff --check`: PASS.
- Public-secret scan trên output doc: PASS, 0 forbidden marker.
- Mojibake scan trên output doc: PASS, 0 marker.
- Runtime smoke: không chạy vì design-only và không có runtime diff.

## 17. Markers

F23_11A_STAFF_FOUNDATION_AUDITED: YES
F23_11A_ACCOUNT_MEMBERSHIP_LIFECYCLE_AUDITED: YES
F23_11A_ATTACHMENT_FOUNDATION_AUDITED: YES
F23_11A_UI_WINDOW_PATTERNS_AUDITED: YES
F23_11A_OPERATIONAL_AND_ADMINISTRATIVE_SEPARATED: YES
F23_11A_ONE_TO_ONE_BY_STABLE_STAFF_ID: YES
F23_11A_PROFILE_DOCUMENT_ATTACHMENT_SCHEMAS_FIXED: YES
F23_11A_ACCESS_PRIVACY_RETENTION_FIXED: YES
F23_11A_ONE_MAIN_SCROLL_OS_CHILD_WINDOW: YES
F23_11A_NO_BINARY_BASE64_PUBLIC_URL_LOCAL_STORAGE: YES
F23_11A_BACKWARD_COMPATIBLE_ROADMAP_AND_QA: YES

ADMINISTRATIVE PROFILE DESIGN COMPLETE - READY FOR F23.11B
