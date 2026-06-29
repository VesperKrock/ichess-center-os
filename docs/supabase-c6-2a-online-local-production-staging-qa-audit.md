# C6.2A - Online/local production-staging QA audit

C6.2A STATUS: ONLINE LOCAL PRODUCTION STAGING QA AUDIT
LATEST_C6_COMMIT: 542ddf2
PRODUCTION_CENTER_ID: dreamhome_prod
STAGING_CENTER_ID: dreamhome
ANGEL_WINGS_KEPT_AS_TEST_SANDBOX: YES
PRODUCTION_EMPTY_EXPECTED: YES
LOCAL_STORAGE_NAMESPACE_SEPARATION_REQUIRED: YES
SIGNED_IN_MEMBERSHIP_WINS_OVER_HARDCODE: YES
GITHUB_PAGES_DEPLOY_QA_REQUIRED: YES
RUNTIME_CHANGE: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
C6_3_STARTED: NO
C6_4_STARTED: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.2A

C6.2A audit hardening sau deploy C6.1, tạo checklist QA để xác nhận local và GitHub Pages dùng cùng logic production/staging separation, không lẫn dữ liệu/cache giữa `dreamhome` staging và `dreamhome_prod` production.

## 2. Trạng thái sau C6.1

C6.1 đã commit/push ở `542ddf2 C6.1 DreamHome production empty center foundation`. Worktree ban đầu C6.2A sạch, branch `main...origin/main`.

Manual provisioning Supabase do user đã hoàn tất:

- `dreamhome` tồn tại và giữ vai trò staging/test sandbox.
- `dreamhome_prod` tồn tại và là DreamHome production empty center.
- `admin.dreamhome@ichess.vn` có membership active:
  - `center_id = dreamhome_prod`
  - `role = center_admin`
  - `status = active`

## 3. Roadmap C6 cập nhật

- C6.0 - Production readiness audit - DONE
- C6.1 - DreamHome production empty center - DONE
- C6.2 - Production/staging separation hardening + online QA - CURRENT
- C6.3 - Multi-center foundation - NEXT
- C6.4 - Minimal owner/admin role binding - DEFERRED
- C6.5 - Internal Center Console - DEFERRED
- C7 - Account/permission/portal system - DEFERRED

## 4. Online/local QA target

Target QA:

- Localhost và GitHub Pages cùng dùng code C6.1 đã deploy.
- GitHub Pages index hiện trả asset `assets/index-CNHhNFOp.js` và `assets/index-DfpCLjpD.css`, khớp build local sau C6.1F.
- QA online vẫn cần login thủ công vì C6.2A không dùng Supabase action và không đọc database live.
- Nếu online vẫn thấy dữ liệu cũ, kiểm tra hard refresh/incognito và trạng thái GitHub Pages deploy trước khi kết luận runtime bug.

## 5. Production/staging separation review

Separation kỳ vọng:

- `dreamhome`: staging/test sandbox, có thể chứa Angel Wings.
- `dreamhome_prod`: DreamHome production empty center.
- Production admin đăng nhập bằng account có membership `dreamhome_prod`.
- Staging user nếu có membership `dreamhome` vẫn vào staging và không bị ép sang production.

## 6. LocalStorage/cache namespace review

Runtime app storage hiện dùng namespace theo center hiện tại:

- `ichessCenterOS.<scope>.dreamhome`
- `ichessCenterOS.<scope>.dreamhome_prod`

Production empty không được đọc fallback từ `.dreamhome`. `.dreamhome` không bị xóa/migrate.

## 7. Cloud bootstrap review

Cloud bootstrap dùng center binding hiện tại. Khi `dreamhome_prod` cloud trống:

- Trạng thái empty production được xem là hợp lệ.
- Local cache cho `dreamhome_prod` được reset/nạp bằng default rỗng.
- Không dùng Angel Wings/staging cache làm fallback production.

## 8. Center resolver review

Sau login, signed-in path resolve active membership từ `center_members`. Membership thắng mọi default/hardcode:

- `resolveActiveCenterMembership(user.id)` đọc active membership.
- `resolveAppCenterBinding(cloudStatus)` bind theo `cloudStatus.centerId`.
- `main.js` truyền `getCurrentResolvedCenterId()` cho readiness/pull/push/realtime/runtime bridge chính.

## 9. GitHub Pages deploy/stale build review

GitHub Pages cũ từng còn 29 học viên vì online vẫn chạy commit trước C6.1. Sau C6.1F, index online đã trả asset hash khớp build local C6.1 (`index-CNHhNFOp.js`, `index-DfpCLjpD.css`). Đây là dấu hiệu deploy asset đã cập nhật.

Manual QA vẫn cần xác nhận bằng login vì dữ liệu hiển thị phụ thuộc Supabase Auth membership và localStorage trình duyệt.

## 10. Manual QA checklist cho production admin

1. Mở GitHub Pages bằng incognito hoặc hard refresh:
   `https://vesperkrock.github.io/ichess-center-os/`
2. Login `admin.dreamhome@ichess.vn`.
3. Kỳ vọng vào DreamHome production empty center.
4. Không thấy 29 học viên staging.
5. Không thấy Angel Wings.
6. Taskbar hiển thị `Cơ sở: DreamHome`.
7. Bấm chip cơ sở mở popover.
8. localStorage có `.dreamhome_prod`.
9. Không xóa `.dreamhome`.
10. Logout/login lại vẫn đúng.

## 11. Manual QA checklist cho staging user nếu có

Nếu có user staging cũ:

1. Login user thuộc center `dreamhome`.
2. Kỳ vọng vẫn thấy staging/Angel Wings.
3. Không bị chuyển sang `dreamhome_prod`.
4. localStorage vẫn namespace `.dreamhome`.

Nếu không có user staging, checklist này deferred/manual optional.

## 12. Manual QA checklist localStorage/devtools

Trong DevTools Console:

```js
Object.keys(localStorage)
  .filter((key) => key.includes("ichessCenterOS"))
  .sort()
```

Kiểm production namespace:

```js
Object.keys(localStorage)
  .filter((key) => key.includes("dreamhome_prod"))
  .sort()
```

Kỳ vọng production admin có key `.dreamhome_prod`; `.dreamhome` nếu tồn tại không bị xóa và không được dùng làm production source.

## 13. Hardcode `dreamhome` classification

Allowed occurrences:

- `CURRENT_CENTER_ID = 'dreamhome'` và `DEFAULT_STORAGE_CENTER_ID = 'dreamhome'` làm staging/dev/signed-out fallback.
- Helper defaults trong module cloud/storage cũ khi caller không truyền center; signed-in C6 path chính đã truyền center resolved.
- Docs/tests cũ mô tả staging/test sandbox hoặc fixture.
- Attendance helper default `dreamhome` cho backward compatibility; `main.js` C6 path truyền `getCurrentResolvedCenterId()`.
- Cloud bridge defaults trong module thấp tầng; `main.js` signed-in callers truyền readiness/resolved center.

Risk classification hiện tại:

- Không thấy `centerId: 'dreamhome'` hoặc `centerId = 'dreamhome'` trong signed-in `main.js` path.
- Không thấy taskbar runtime hiển thị `Cloud trống (production empty center)`.
- Cần tiếp tục QA online để chắc chắn browser localStorage cũ không làm user nhầm với stale data.

## 14. Risk list

- User có nhiều active memberships: C6.1D chọn membership đầu theo `center_id`; center picker defer.
- Browser đã từng mở bản cũ có thể còn localStorage `.dreamhome`; cần incognito/hard refresh để QA production.
- GitHub Pages deploy có thể trễ; asset hash phải kiểm tra trước khi kết luận bug.
- Một số helper thấp tầng vẫn có default `dreamhome`; đây là allowed backward compatibility nhưng cần tiếp tục giữ signed-in entrypoints truyền center resolved.

## 15. C6.2B recommendation nếu cần

Nếu manual online QA phát hiện production admin vẫn thấy staging/Angel Wings hoặc `.dreamhome` được đọc vào production, tạo C6.2B hotfix tập trung vào đúng call-site gây lẫn cache. Nếu QA pass, có thể đi C6.2B hardening nhỏ hoặc C6.2E review tùy còn việc.

## 16. C6.3 deferred

C6.3 Multi-center foundation là NEXT, chưa bắt đầu trong C6.2A.

## 17. C6.4 deferred

C6.4 Minimal owner/admin role binding deferred, chưa làm trong C6.2A.

## 18. C6.5 Internal Center Console deferred

C6.5 Internal Center Console deferred. Không tạo `/internal/centers`, không tạo nút thêm cơ sở, không tạo Gò Vấp/Quận 12.

## 19. C7 deferred

C7 Account/permission/portal system deferred. Không username login, không account management, không Teacher Portal, không Super Admin.

## 20. PASS / NEEDS REVIEW criteria

PASS nếu docs/test C6.2A đầy đủ, all C6 smokes pass, build pass, diff-check pass, không runtime change, không SQL/Supabase action, không file ngoài scope, và hardcode `dreamhome` được phân loại rõ.

NEEDS REVIEW nếu phát hiện signed-in production path hardcode `dreamhome`, production đọc `.dreamhome`, GitHub Pages asset stale không giải thích được, hoặc manual QA online thấy lẫn staging/production.
