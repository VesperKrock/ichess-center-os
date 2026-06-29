# C6.1D.1 - Taskbar profile wording polish

C6.1D.1 STATUS: TASKBAR PROFILE WORDING POLISH
TASKBAR_TECHNICAL_EMPTY_TEXT_VISIBLE: NO
CENTER_PROFILE_POPOVER: YES
CENTER_CHIP_IS_PROFILE_ENTRY: YES
PRODUCTION_EMPTY_TEXT_MOVED_OUT_OF_TASKBAR: YES
CENTER_RESOLVER_CHANGED: NO
CACHE_GUARD_CHANGED: NO
SQL_APPLIED_BY_CODEX: NO
SUPABASE_ACTION_BY_CODEX: NOT RUN
ANGEL_WINGS_DELETED: NO
ANGEL_WINGS_MIGRATED: NO
C6_5_INTERNAL_CONSOLE_STARTED: NO
C7_STARTED: NO
COMMIT: NOT RUN
PUSH: NOT RUN

## 1. Mục tiêu C6.1D.1

C6.1D.1 chỉ polish wording production trên taskbar và thêm center/profile popover nhẹ. Mục tiêu là giữ taskbar gọn, phù hợp production UI, không để người dùng cuối thấy wording kỹ thuật như `production empty center`.

## 2. Trạng thái trước C6.1D.1

C6.0, C6.1A, C6.1B, C6.1C và C6.1D đã PASS. Latest commit vẫn là `6fa4608 F23 feedback 2706 polish checkpoint`. Worktree có các docs/tests/runtime C6 trước đó, không commit/push.

## 3. Manual QA C6.1D đã pass

User đã xác nhận login `admin.dreamhome@ichess.vn` vào đúng `dreamhome_prod`, dashboard không hiện Angel Wings, localStorage có namespace `.dreamhome_prod` tách với `.dreamhome`.

## 4. Vấn đề wording production empty center

Taskbar trước C6.1D.1 có thể hiện `Dữ liệu: Cloud trống (production empty center)`. Wording này hữu ích cho dev/QA nhưng quá kỹ thuật với production UI.

## 5. Quyết định taskbar production wording

Taskbar không hiển thị data status kỹ thuật khi bình thường. Taskbar giữ entry gọn:

- `Cơ sở: DreamHome`

Data status được đưa vào popover bằng wording thân thiện:

- `Dữ liệu: Cloud`
- `Trạng thái: Sẵn sàng`

## 6. Center/profile popover

Chip `Cơ sở: DreamHome` trên taskbar là entry point cho thông tin phiên làm việc. Bấm chip mở popover; bấm lại hoặc bấm ra ngoài để đóng.

## 7. Thông tin hiển thị trong popover

Popover hiển thị:

- Cơ sở
- Tài khoản
- Vai trò
- Dữ liệu
- Trạng thái
- Mã cơ sở

Fallback an toàn:

- Tài khoản: `Đang đăng nhập`
- Vai trò: `Chưa xác định`
- Dữ liệu: `Cloud` hoặc `Cache cục bộ`
- Trạng thái: `Sẵn sàng`, `Đang kiểm tra`, hoặc `Cần kiểm tra`

## 8. Những gì không làm trong phase này

Không đổi center resolver, không đổi cache guard, không đổi cloud bootstrap behavior ngoài wording UI. Không SQL, không Supabase action, không xóa/migrate Angel Wings, không reset localStorage `.dreamhome`, không tạo account management hay permission override.

## 9. C6.5 Internal Center Console deferred

C6.1D.1 không tạo C6.5 Internal Center Console, không tạo route `/internal/centers`, không tạo nút thêm cơ sở.

## 10. C7 deferred

C6.1D.1 không mở C7, không username login, không Teacher Portal, không Super Admin, không public/customer-facing roadmap.

## 11. Files changed

Runtime:

- `src/main.js`
- `src/styles.css`

Docs:

- `docs/supabase-c6-1d-1-taskbar-profile-wording-polish.md`

Tests:

- `tests/supabase-c6-1d-1-taskbar-profile-wording-polish-smoke.js`

Existing smoke allowlists updated for C6.1D.1 docs/test/style scope.

## 12. Manual QA checklist

1. Login `admin.dreamhome@ichess.vn`.
2. Dashboard vẫn vào `dreamhome_prod`.
3. Taskbar không hiện `Cloud trống (production empty center)`.
4. Taskbar hiển thị gọn `Cơ sở: DreamHome`.
5. Bấm `Cơ sở: DreamHome` mở popover.
6. Popover có Tài khoản, Vai trò, Dữ liệu, Trạng thái, Mã cơ sở.
7. Bấm ra ngoài popover đóng.
8. Không thấy Angel Wings.
9. localStorage `.dreamhome_prod` vẫn riêng, `.dreamhome` không bị xóa.
10. Staging user cũ nếu có vẫn không bị ảnh hưởng.

## 13. PASS / NEEDS REVIEW criteria

PASS khi taskbar không còn wording kỹ thuật production empty, center chip mở được popover, không đổi resolver/cache/cloud logic, không SQL/Supabase, không C6.5/C7, build và smokes pass.

NEEDS REVIEW nếu phải sửa resolver/cache/cloud logic, cần SQL/Supabase action, phát hiện file ngoài scope, hoặc popover không có hook UI an toàn.
