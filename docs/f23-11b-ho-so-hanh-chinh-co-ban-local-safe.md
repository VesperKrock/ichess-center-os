# F23.11B - Hồ sơ hành chính cơ bản local-safe

Ngày: 2026-07-27  
Phạm vi: runtime public local-safe, không migration, không cloud write, không deploy.

> F23.11B.1 (2026-07-27): fresh Module Nhân viên dùng `Tất cả trạng thái`; no-data được tách khỏi no-match có action xóa filter; deep-open Giáo viên → Nhân viên resolve bằng stable ID và reset list filters. Literal lịch mặc định đã được sửa UTF-8, còn legacy mojibake chỉ được repair an toàn tại display boundary Chấm công, không rewrite storage. Xem `docs/f23-11b-1-hotfix-default-filter-nhan-vien-va-mojibake-cham-cong.md`.

> F23.11B.2 (2026-07-27): sửa DOM scope của Hiện/Ẩn bằng delegated handler tại OS window root; reveal identity là center + profile ID + canonical field path. Happy path chỉ đổi text node/button tại chỗ, không save/revision/storage/full render; state reset khi close/reload/switch center/mất quyền. Xem `docs/f23-11b-2-hotfix-hien-an-du-lieu-nhay-cam.md`.

## 1. Kết quả

F23.11B thêm Hồ sơ hành chính dưới dạng entity riêng, không mở rộng `centerStaffMembers` thành hồ sơ nhân sự tổng hợp. Mỗi record liên kết đến đúng một hồ sơ Nhân viên bằng stable `staffMemberId`; mã nhân viên, tên hiển thị, phòng ban, chức danh, lifecycle, Teacher link và account/membership link vẫn thuộc nguồn vận hành hiện hữu.

Hồ sơ được mở trong một OS child window riêng, rộng và mặc định maximized. Một staff trong một center chỉ có một window; action lần sau focus window đang có. Window tham gia taskbar, minimize, maximize/restore và close theo shell hiện tại.

## 2. Storage contract

Scope canonical:

```txt
centerStaffAdministrativeProfiles
```

Key runtime do helper center-scoped hiện hữu tạo:

```txt
ichessCenterOS.centerStaffAdministrativeProfiles.<normalizedCurrentCenterId>
```

Không hardcode center. `getStoredCenterStaffAdministrativeProfiles()` chỉ đọc và normalize read model; khi key chưa tồn tại, hàm trả collection mặc định nhưng không ghi key. JSON/collection/record malformed được đánh dấu cần kiểm tra, không xóa và không auto-rewrite. Chỉ `saveStoredCenterStaffAdministrativeProfiles()` sau một action explicit, qua collection integrity check, mới ghi local storage.

## 3. Schema thực tế

```js
{
  ...unknownFields,
  id,
  schemaVersion: 1,
  centerId,
  staffMemberId,

  legalFullName,
  dateOfBirth,
  gender, // reserved, UI B không thu thập
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
  completionStatus, // incomplete | complete | needs-review
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

`not-created` và staff archive là trạng thái derived, không được ghi thành lifecycle thay thế trong profile.

## 4. Normalizer và backward compatibility

Normalizer chỉ trim outer whitespace và giữ các number nghiệp vụ dưới dạng string để không mất leading zero. Record và từng nested plain object đều spread unknown fields trước khi canonical field được normalize. Không lower-case, bỏ dấu, ép number hoặc tự sửa ngày.

Nested value không phải plain object, missing stable ID, explicit center mismatch, schema/revision/timestamp sai, completion review không coherent, duplicate profile ID hoặc duplicate `centerId + staffMemberId` đều làm collection fail-closed. Dữ liệu raw vẫn nằm nguyên trong storage để review; phase này không có silent migration.

Record legacy thiếu `centerId` chỉ được resolve theo namespace center-scoped đang đọc. Explicit center khác không được relink.

## 5. One-to-one và stale-write guard

Invariant:

```txt
centerStaffMembers (1) -- stable staffMemberId -- (0..1) centerStaffAdministrativeProfiles
```

Create kiểm tra latest center, latest active membership, latest staff và latest profile collection. Nếu profile đã tồn tại, create dừng. Edit capture `centerId`, `staffMemberId`, `profileId`, `revision`, `updatedAt`; trước write phải resolve đúng một latest record và match toàn bộ marker. Save replace đúng một profile, giữ `id`, `createdAt`, unknown fields và tăng `revision` đúng một.

Guard in-memory theo window và guard toàn cục chặn double-submit trong lúc membership/latest-record check đang chạy.

## 6. Field và validation

Tất cả field nội dung đều optional khi save draft. `legalFullName` prefill từ latest staff display name khi bấm tạo nhưng chưa persist. Completion checklist mới quyết định đủ điều kiện hoàn thiện.

Validation gồm:

- text length theo F23.11A;
- phone khẩn cấp dạng text, kiểm tra mềm 6-30 ký tự nếu có;
- ngày phải là real `YYYY-MM-DD`;
- ngày sinh/ngày cấp/ngày đăng ký thuế/ngày ký không ở tương lai;
- ngày cấp không sau ngày hết hạn giấy tờ;
- ngày ký không sau ngày hiệu lực;
- ngày hiệu lực không sau ngày hết hạn hợp đồng;
- number giấy tờ/thuế/bảo hiểm/tài khoản không bị number coercion.

Validation lỗi giữ window, draft, reveal state và content scroll; focus field đầu tiên dùng `preventScroll` sau khi điều chỉnh đúng content scroller.

## 7. Completion checklist

Profile mới luôn `incomplete`. Checklist `f23.11b-v1` cần:

- `legalFullName`;
- `dateOfBirth`;
- `currentAddress.addressLine` và `currentAddress.provinceOrCity`;
- `emergencyContact.name`, `phone`, `relationship`.

Owner hoặc center admin phải bấm explicit `Đánh dấu đã kiểm tra` để set `complete` và ghi actor/time/checklist version. Sửa một checklist field hoặc dữ liệu Group B sau review chuyển `complete` thành `needs-review` và clear approval hiện hành. Audit event append-only đầy đủ thuộc phase sau.

## 8. Access matrix

| Membership hiện tại | View | Create/edit/review |
| --- | --- | --- |
| owner, active, đúng center | Allow | Allow |
| center_admin, active, đúng center | Allow | Allow |
| admin alias, active, đúng center | Normalize thành center_admin, allow | Allow |
| teacher | Deny | Deny |
| consultant | Deny | Deny |
| inactive/revoked/paused/missing/malformed | Deny | Deny |
| active nhưng center khác | Deny | Deny |

Guard dựa trên live account membership, không dựa trên HR position, Teacher link hay staff-account link. Unauthorized open không tạo window chứa profile; nếu quyền mất khi window đang mở, draft/reveal state bị xóa và renderer chỉ trả safe denial. Save/review đọc membership mới nhất và fail closed khi không đọc được.

## 9. Child window và UI

Window type là `staff-administrative-profile`; identity window là `centerId + stable staffMemberId`. Title/taskbar chỉ chứa dữ liệu vận hành `employeeCode + display name`, không chứa metadata nhạy cảm. Không có desktop launcher riêng.

Header hiển thị read-only employee code, display name, phòng ban, chức danh, employment/archive và completion status. Các giá trị này không được copy vào profile save. Form có các section Tổng quan, Thông tin cá nhân, Địa chỉ, Liên hệ khẩn cấp, Giấy tờ tùy thân, Thuế và bảo hiểm, Tài khoản ngân hàng, Hành chính hợp đồng và Ghi chú hành chính.

Outer `.window-body` của window này `overflow: hidden`. Header/navigation cố định trong layout; `.staff-administrative-content-scroll` là content scroller dọc duy nhất. Không có nested modal hoặc form scroller.

## 10. Create/edit flow

Open empty state không tạo record. `Tạo hồ sơ hành chính` chỉ khởi tạo in-memory draft, prefill legal name và giữ stable staff link ở window state. Submit validate, latest-read, one-to-one check, sinh stable profile ID rồi ghi đúng một record.

Edit chỉ mở từ one-to-one record khỏe. Save giữ identity/createdAt/unknown fields, kiểm tra stale marker và replace record. Profile edit không gọi staff save, lifecycle transition, Teacher link hoặc account membership mutation.

## 11. Mask/reveal và privacy boundary

Mặc định mask riêng:

- số giấy tờ;
- mã số thuế;
- số BHXH và BHYT;
- số tài khoản ngân hàng;
- số hợp đồng.

Mỗi field có action Hiện/Ẩn riêng; không có reveal-all. Reveal set chỉ nằm trong memory của window. Đóng window, reload app, switch center hoặc mất quyền đều xóa set. Validation re-render giữ reveal state để không phá thao tác đang làm.

Profile, nested sensitive values và note không đi vào staff search, global list, title, taskbar, toast, dataset hay log. HTML output và attribute đều escape; reveal cập nhật `textContent`, không dựng HTML từ value.

## 12. Archive và lifecycle

Archive/restore staff không delete, archive hoặc mutate profile. Staff đã archive vẫn cho owner/admin xem profile nhưng window read-only và yêu cầu restore staff trước khi edit/review. Staff lifecycle change không ghi profile; profile save không ghi `employmentStatus`, `endDate`, lifecycle history, Teacher/account link.

Phase này chưa có profile hard delete hoặc profile archive action.

## 13. No-binary và tài liệu

F23.11B chỉ lưu metadata text nhỏ. Runtime không có file input, binary object, encoded file content, object URL hay signed access URL trong profile/local storage. Không có upload, preview, document record hoặc attachment record.

F23.11C mới thiết kế runtime danh mục tài liệu và metadata hạn hiệu lực theo chain stable IDs. Attachment về sau phải dùng storage private, metadata tách binary, locator opaque và short-lived access; không dùng public URL. F23.11D mới bổ sung audit/retention/archive/deletion workflow nâng cao.

## 14. Test và manual QA

Automated smoke: `tests/f23-11b-ho-so-hanh-chinh-co-ban-local-safe-smoke.js` bao phủ schema/normalizer, center-scoped storage, no auto-write, one-to-one, revision, unknown fields, checklist, role/membership deny, masking, escaping, child-window/taskbar/focus markers, one-scroll contract, no-binary/logging/public-surface scans và lifecycle isolation.

Regression bắt buộc gồm F23.10B/C1/C1.1/D/E/E.1, storage/center, role, window/taskbar và focus/scroll suites được liệt kê trong report chạy kiểm tra.

Manual QA chưa được tự động kết luận PASS. Dùng fixture giả, không nhập giấy tờ/tài khoản thật; xác nhận one window, taskbar, empty không ghi, create/edit/reload, mask từng field, close/reopen reset mask và staff archive read-only.

Checklist manual với một staff QA có stable ID:

1. Đăng nhập owner hoặc center admin active của đúng center, mở Module Nhân viên và bấm `Mở hồ sơ hành chính`.
2. Xác nhận window lớn có đúng một taskbar button; bấm action lần hai chỉ focus window cũ; minimize/maximize/restore/close vẫn hoạt động.
3. Với staff chưa có profile, xác nhận `Chưa có Hồ sơ hành chính.`, kiểm tra key storage vẫn chưa được tạo chỉ vì mở.
4. Bấm `Tạo hồ sơ hành chính`, xác nhận Họ tên theo giấy tờ được prefill nhưng chưa persist; nhập dữ liệu QA giả và bấm `Tạo hồ sơ` đúng một lần.
5. Sau save/reload, xác nhận các số nhạy cảm đều mask; Hiện một field không reveal field khác; close/reopen reset về mask.
6. Edit địa chỉ/ghi chú, save, reload và xác nhận vẫn đúng một profile, ID/createdAt giữ nguyên, revision tăng; staff employment/lifecycle/link không đổi.
7. Với staff archive giả lập trong automated fixture hoặc một record QA riêng, xác nhận profile còn nguyên và window chỉ đọc. Không archive fixture vận hành thật chỉ để chạy checklist.
8. Role teacher/consultant/inactive/malformed được xác nhận bằng automated smoke; không đổi role production để thử deny.

## 15. Giới hạn

F23.11B không có documents/attachments, upload/download, expiry notification, payroll, self-service, cloud sync, migration, SQL, deployment hoặc thay đổi role. Roadmap kế tiếp chỉ bắt đầu sau khi manual QA phase này đạt yêu cầu.
