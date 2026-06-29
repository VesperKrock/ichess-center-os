# C6.1E - Checkpoint review DreamHome production empty center

C6.1E STATUS: CHECKPOINT REVIEW BEFORE COMMIT PUSH
LOCALHOST_DREAMHOME_PROD_EMPTY_QA: PASS
GITHUB_PAGES_OLD_BUILD_EXPECTED: YES
GITHUB_PAGES_PUSHED_C6: NO
LATEST_PUSHED_COMMIT_BEFORE_C6: 6fa4608
STAGING_CENTER_ID: dreamhome
PRODUCTION_CENTER_ID: dreamhome_prod
ANGEL_WINGS_KEPT_AS_TEST_SANDBOX: YES
DREAMHOME_PROD_ADMIN_MEMBERSHIP: ACTIVE
TASKBAR_TECHNICAL_EMPTY_TEXT_VISIBLE: NO
CENTER_PROFILE_POPOVER: YES
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.1E

C6.1E là checkpoint review trước commit/push/deploy cho DreamHome production empty center. Phase này chỉ tổng hợp trạng thái, xác nhận safety, chạy lại test/build/diff và đưa recommendation sang C6.1F nếu PASS.

## 2. Trạng thái trước checkpoint

- Latest pushed commit trước C6: `6fa4608 F23 feedback 2706 polish checkpoint`.
- C6 local chưa commit/push.
- Worktree chứa docs/tests/runtime của C6.0 đến C6.1D.1.
- Không chạy SQL, không Supabase action, không commit/push trong checkpoint này.

## 3. Tổng hợp C6.0

C6.0 là production readiness audit trước khi tạo DreamHome production empty center. Phase này chỉ audit/design/docs/test, phân biệt staging Angel Wings với production DreamHome, không migrate/seed/clear dữ liệu.

## 4. Tổng hợp C6.1A

C6.1A thiết kế DreamHome production empty center. Chốt production center sạch, không migrate Angel Wings, không seed staging, không reset localStorage tự động. Account advanced, username login, Teacher Portal và Super Admin đều defer.

## 5. Tổng hợp C6.1B

C6.1B tạo read-only verification pack cho DreamHome production empty center. Verification kiểm center/membership/role/entity/realtime/local cache risk và hướng một link chung dựa vào tài khoản/membership để vào đúng center.

## 6. Tổng hợp C6.1C

C6.1C chốt production/staging split:

- `dreamhome` giữ làm staging/test sandbox.
- `dreamhome_prod` là DreamHome production empty center.
- Angel Wings giữ ở staging, không xóa, không migrate.
- Manual apply template dùng placeholder user_id cho admin DreamHome production.

## 7. Tổng hợp C6.1D

C6.1D implement account-based center resolver + production empty cache guard:

- Sau login, app resolve center từ `center_members`.
- Admin DreamHome bind vào `dreamhome_prod`.
- Signed-in runtime không fallback localStorage/Angel Wings từ `dreamhome` vào production empty.
- Local cache được namespace theo center, ví dụ `.dreamhome_prod`.

## 8. Tổng hợp C6.1D.1

C6.1D.1 polish taskbar production wording:

- Taskbar không còn text kỹ thuật `Cloud trống (production empty center)`.
- Taskbar giữ chip gọn `Cơ sở: DreamHome`.
- Bấm chip mở center/profile popover gồm tài khoản, vai trò, dữ liệu, trạng thái, mã cơ sở.

## 9. Supabase manual provisioning đã hoàn tất

User đã hoàn tất manual provisioning trong Supabase:

- `public.centers`: `dreamhome`, `dreamhome_prod`.
- `public.center_members`:
  - email: `admin.dreamhome@ichess.vn`
  - user_id: `74a0c255-e6cd-4e31-89a1-c7d455ef5574`
  - center_id: `dreamhome_prod`
  - role: `center_admin`
  - status: `active`

Codex không chạy SQL và không thực hiện Supabase action.

## 10. Manual QA localhost đã pass

Manual QA hiện tại:

- Login localhost bằng `admin.dreamhome@ichess.vn`.
- App vào DreamHome production empty center.
- Taskbar hiển thị `Cơ sở: DreamHome`.
- Dữ liệu không còn Angel Wings.
- localStorage có namespace `.dreamhome_prod` song song `.dreamhome`.
- C6.1D.1 manual QA pass: taskbar không còn wording kỹ thuật production empty, chip cơ sở mở popover.

## 11. Vì sao GitHub Pages vẫn còn 29 học viên

Đây là expected, không phải bug runtime C6.1D.

Lý do: localhost đang chạy code C6 local chưa push/deploy, còn GitHub Pages vẫn chạy bản đã push gần nhất ở commit `6fa4608`. Vì vậy GitHub Pages còn thấy dữ liệu cũ như 29 học viên cho đến khi C6 được commit/push/deploy trong C6.1F.

Không kết luận đây là lỗi resolver/cache guard. Không push trực tiếp trước checkpoint review.

## 12. Safety review

- SQL applied by Codex: NO.
- Supabase action by Codex: NOT RUN.
- Angel Wings deleted/migrated: NO.
- `dreamhome` cache deleted/migrated: NO.
- C6.5 Internal Center Console started: NO.
- C7 started: NO.
- Teacher Portal/Super Admin: NOT STARTED.
- Commit/push: NOT RUN.

## 13. Runtime review

Runtime changes hiện có đến C6.1D.1 nằm trong scope:

- `src/supabase-auth.js`
- `src/app-center-binding.js`
- `src/storage.js`
- `src/main.js`
- `src/cloud-status.js`
- `src/cloud-bootstrap.js`
- `src/cloud-db-sync.js`
- `src/styles.css`

C6.1E không thêm runtime change mới.

## 14. Storage/cache review

Cache design hiện tại:

- `dreamhome` là staging/test sandbox.
- `dreamhome_prod` là production empty center.
- LocalStorage app data dùng namespace theo center.
- `.dreamhome` không bị xóa/migrate.
- `.dreamhome_prod` tách riêng để production empty không nhận Angel Wings staging cache.

## 15. SQL/Supabase review

C6.1E không tạo SQL apply mới, không chạy SQL, không gọi Supabase Dashboard/API. Các SQL trong worktree là C6.1B/C6.1C verification/preflight/manual template trước đó.

## 16. C6.5 Internal Center Console deferred

C6.1E không tạo C6.5 Internal Center Console, không tạo route `/internal/centers`, không tạo nút thêm cơ sở.

## 17. C7 deferred

C7 vẫn deferred. Không username login, không account management, không permission override, không Teacher Portal, không Super Admin.

## 18. Files changed summary

Docs C6:

- C6.0, C6.1A, C6.1B, C6.1C, C6.1D, C6.1D.1, C6.1E checkpoint docs.

Tests C6:

- Smoke tests C6.0 đến C6.1E.

Runtime C6:

- Account-based resolver, center-scoped cache guard, taskbar center/profile popover.

SQL:

- C6.1B read-only verification SQL.
- C6.1C read-only preflight SQL.
- C6.1C manual apply template only.
- No C6.1E SQL.

## 19. Test/build/diff checklist

Required checks:

- C6.0 smoke.
- C6.1A smoke.
- C6.1B smoke.
- C6.1C smoke.
- C6.1D smoke.
- C6.1D.1 smoke.
- C6.1E smoke.
- `npm run build`.
- `git diff --check`.
- `git status --short`.
- `git log -1 --oneline`.

## 20. PASS / NEEDS REVIEW criteria

PASS if all C6 smokes pass, build passes, diff-check passes, worktree contains only expected C6 files, no SQL/Supabase action is run by Codex, GitHub Pages old build is correctly classified as expected, and no C6.5/C7 scope is started.

NEEDS REVIEW if runtime blocker appears, file scope is unexpected, SQL/Supabase action becomes necessary, GitHub Pages old build is misclassified as a runtime bug, or any required smoke/build check fails.

## 21. Recommendation sang C6.1F

Recommendation: GO for C6.1F commit/push/deploy if C6.1E checks PASS.

After C6.1F push/deploy, test GitHub Pages with hard refresh or incognito, login `admin.dreamhome@ichess.vn`, confirm app binds to `dreamhome_prod`, production is empty, taskbar shows `Cơ sở: DreamHome`, and popover opens correctly.
