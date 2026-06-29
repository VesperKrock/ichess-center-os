# F23D - UI readiness cho designer: image slots / theme hooks

F23D STATUS: UI READINESS ONLY

SQL: NOT CREATED / NOT RUN
SUPABASE ACTION: NOT RUN
CLOUD_SYNC: NO
RUNTIME CHANGE: YES, VISUAL HOOKS ONLY
COMMIT: NOT RUN
PUSH: NOT RUN
LOGIC_CHANGE: NO
DATA_FLOW_CHANGE: NO
LOCAL_STORAGE_KEY_CHANGE: NO
REAL_IMAGE_ASSET_ADDED: NO
DESIGNER_READY_HOOKS: YES
C6_STARTED: NO
F23E_STARTED: NO

## 1. Mục tiêu F23D

F23D là UI readiness / visual hook phase để chuẩn bị cho designer nạp logo, banner, icon module, visual slot và theme sau này. Phase này không phải redesign, không đổi logic/chức năng và không mở C6.

Nguyên tắc asset: không thêm ảnh thật/asset thật.

Nguyên tắc backend: không SQL/Supabase/cloud/realtime.

## 2. Trạng thái trước F23D

- Latest commit: `c40feb2 C5.3 audit conflict rollback checkpoint`
- F23A: PASS.
- F23B: PASS, accepted limitation checklist chưa persist qua reload.
- F23C: PASS.
- F23C.1: PASS, Đối soát nằm trong Sổ quỹ.
- Worktree trước F23D: chỉ có F23A/B/C/C.1 expected files.

## 3. Feedback anh Hải liên quan F23D

Anh Hải muốn sau này có một đợt tân trang giao diện với designer/người thiết kế đồ họa. Trước mắt cần tạo các không gian để chuẩn bị nạp dữ liệu liên quan hình ảnh/theme, nhưng không đụng logic hoặc chức năng phần mềm.

## 4. Files đã sửa/tạo

Runtime/UI hooks:

- `src/main.js`

Styles:

- `src/styles.css`

Docs/test:

- `docs/feedback-f23d-ui-readiness-designer-image-slots-theme-hooks.md`
- `tests/feedback-f23d-ui-readiness-designer-image-slots-theme-hooks-smoke.js`

Không thêm ảnh thật, không thêm asset thật, không sửa SQL/cloud/package files.

## 5. Theme hooks / design tokens

F23D thêm theme hooks/design tokens nhẹ trong `:root`:

- `--ichess-bg`
- `--ichess-surface`
- `--ichess-surface-soft`
- `--ichess-border`
- `--ichess-text`
- `--ichess-muted`
- `--ichess-accent`
- `--ichess-accent-soft`
- `--ichess-designer-slot-border`

Các token này không đổi data flow và không ép redesign toàn app.

## 6. Image slots / visual slots

F23D chuẩn bị các image slots / visual slots:

- `.center-brand-slot`
- `.center-logo-slot`
- `.center-banner-slot`
- `.module-card-icon-slot`
- `.module-card-visual-slot`
- `.module-window-hero-slot`
- `.module-visual-placeholder`
- `.designer-image-slot`

Các slot mặc định không nạp ảnh, không dùng URL ảnh giả, không thêm external image và không tạo asset file.

## 7. Class/data hooks cho designer

F23D thêm class/data hooks ổn định:

- `.designer-theme-hook`
- `data-designer-hook="center-brand"`
- `data-designer-hook="module-card"`
- `data-designer-hook="module-window"`
- `data-module-title`

Các hook này chỉ phục vụ styling/designer, không đổi module routing hoặc event handler.

## 8. Visible polish tối thiểu nếu có

Polish chỉ ở mức giữ slot không làm layout vỡ:

- Slot center brand/logo/banner đang ẩn kích thước 0 để không tạo ô trống xấu.
- Slot module card dùng vị trí tuyệt đối, không làm module card phình.
- Slot window hero opacity 0, chuẩn bị hook cho designer nhưng không che titlebar.

## 9. Những gì F23D không làm

- Không redesign toàn app.
- Không thêm ảnh thật/asset thật.
- Không import UI library.
- Không đổi logic/chức năng.
- Không đổi data flow.
- Không đổi localStorage key.
- Không SQL/Supabase/cloud/realtime.
- Không mở C6.
- Không mở F23E.
- Không commit/push.

## 10. Không đổi logic/chức năng

F23D không đổi handler mở module, không đổi taskbar/window behavior, không đổi auth/role/permission và không đổi bất kỳ nghiệp vụ nào.

## 11. Không thêm ảnh thật/asset thật

Không có file `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif` mới do F23D tạo. Các slot chỉ là class/data hooks.

## 12. Không SQL/Supabase/cloud/realtime

F23D không tạo SQL, không chạy SQL, không gọi Supabase, không thêm cloud sync và không thêm realtime.

## 13. Manual QA plan

1. Reload app local.
2. Kiểm tra dashboard vẫn hiển thị đủ module.
3. Mở một vài module chính: Báo cáo, Nhóm Tài chính, Học phí, Thời khóa biểu.
4. Kiểm tra layout không vỡ.
5. Kiểm tra module cards không phình xấu bất thường.
6. Kiểm tra window header/taskbar vẫn hoạt động.
7. Kiểm tra Start/taskbar/module open/close vẫn bình thường.
8. Kiểm tra không có ảnh lỗi/broken image.
9. Kiểm tra không có lỗi console nghiêm trọng.

## 14. Risks / limitations

- F23D chỉ chuẩn bị hooks/slots.
- Designer thật chưa nạp ảnh/theme.
- Không có visual redesign hoàn chỉnh trong phase này.

## 15. Next recommendation

Nếu F23D PASS: user chạy manual QA F23D.

Nếu manual QA pass/accepted: GO for F23E — Checkpoint review F23.
