# F23.3B - CRM shell Phụ huynh/Tư vấn local-safe

Ngày: 21/07/2026

## Đã triển khai

CRM shell được triển khai trong Module Phụ huynh / Tư vấn hiện có:

- `src/parent-consultation-module.js`
- `src/storage.js`
- `src/main.js`
- `src/styles.css`

Không tạo module mới và vẫn dùng store local `parentConsultations[]`.

## Hotfix polish form

Hotfix F23.3B đã lược bỏ header/subtitle nội dung `Phụ huynh / Tư vấn - CRM khách hàng gia đình` vì titlebar OS đã có tên module. Dashboard/list giữ stats, filter và badge phase gọn hơn.

Form `+ Thêm khách mới` được tăng chiều cao bằng layout viewport-safe, có body scroll riêng và footer sticky để nút `Quay lại`, `Tiếp theo`, `Hủy`, `Lưu liên hệ` không bị taskbar che/cắt.

Bug mất focus/dropdown trong wizard được xử lý bằng cách không rerender toàn bộ modal khi user chỉ gõ, chuyển focus input, mở dropdown hoặc đổi giá trị field thường. State form vẫn cập nhật nhẹ trong handler input/change. Draft `Lịch hẹn & đăng ký dự kiến` chỉ sync khi đổi step bằng tab/nút hoặc khi bấm action trực tiếp của step 4 như lưu/đánh dấu/copy thông tin học thử.

Step 2 `Học viên mới / bé cần tư vấn` được tách layout hai cột: khối thông tin bé mới bên trái và `Học viên liên quan` bên phải. Field `Họ và tên bé tư vấn` dùng input chuẩn, cân với năm sinh/tuổi, chương trình quan tâm và `Nhu cầu học / ghi chú ban đầu`.

## `customerStage`

Module hiển thị 3 stage khách hàng:

- `lead` - Khách mới
- `consulting` - Đang tư vấn
- `converted` - Đã chuyển đổi

Nếu contact cũ chưa có `customerStage`, UI derive fallback khi render:

- `consultationStatus === "converted"`, `contactType === "currentParent"`, có `studentId` hoặc `linkedStudentIds` thì là `converted`.
- `contactType === "consultingLead"` với trạng thái `waitingResponse`, `trialScheduled`, `pendingEnrollment`, `activeCare` thì là `consulting`.
- Có `careLogs`, `appointments`, `nextAction`, `nextFollowUpAt` hoặc `enrollmentDraft` thì là `consulting`.
- Còn lại là `lead`.

Storage normalize thêm các field backward-compatible: `customerStage`, `consultantId`, `consultantName`, `advisorName`, `linkedStudentIds`, `nextFollowUpAt`, `potentialLevel`.

## Danh sách và filter

Màn chính Module Phụ huynh / Tư vấn là CRM workspace với stats:

- Tổng khách
- Khách mới
- Đang tư vấn
- Cần follow-up
- Đã chuyển đổi

Toolbar có filter stage: Tất cả, Khách mới, Đang tư vấn, Đã chuyển đổi. Bảng hiển thị stage, trạng thái tư vấn, tư vấn phụ trách fallback, nguồn, nhu cầu/chương trình quan tâm, next action, số học viên liên kết và badge ghi chú.

## Form thêm lead local-safe

Nút `+ Thêm khách mới` mở form local-safe. Form lưu vào `parentConsultations[]`, mặc định:

- `customerStage = "lead"`
- `consultationStatus = "newLead"`

Form cho nhập tên khách/phụ huynh, số điện thoại, nguồn, tên bé, tuổi/năm sinh, nhu cầu học, chương trình quan tâm, lịch mong muốn, tư vấn phụ trách và ghi chú đầu tiên. Nếu thiếu cả tên và số điện thoại thì không lưu. Ghi chú đầu tiên được lưu vào `contact.careLogs`.

## Detail và ghi chú chăm sóc

Detail khách hàng hiển thị tổng quan liên hệ, funnel, tư vấn phụ trách, nhu cầu, next action, học viên liên kết và lịch sử ghi chú chăm sóc. Nút `Sửa nhẹ` mở form edit các field MVP như stage, trạng thái, tư vấn phụ trách, next action, nhu cầu, chương trình, lịch mong muốn và thông tin liên hệ.

Ghi chú chăm sóc CRM lưu local-safe vào:

```txt
contact.careLogs[]
```

Ghi chú CRM trước convert không ghi vào `student.careNotes`.

## Convert CTA

Detail có box `Chuyển đổi khách hàng`, nhưng button đang disabled:

```txt
Chuyển đổi ở phase sau
```

F23.3B chưa tạo học viên, chưa tạo phụ huynh thật, chưa tạo học phí và chưa cập nhật `tuition.usedSessions`.

## Guard scope

Không sửa sâu Module Học viên/Học phí, không tạo student/tuition, không Auth/Supabase/SQL/cloud/deploy, không Teacher Workspace, không push/commit.

## Test đã chạy

Smoke chính:

```txt
node tests/f23-3b-crm-shell-phu-huynh-tu-van-local-safe-smoke.js
```

Regression liên quan Phụ huynh/Tư vấn:

```txt
node tests/fb-admin-dreamhome-vong-1-3-settings-parent-wiring-smoke.js
node tests/fb-admin-dreamhome-vong-1-3-followup-select-window-parent-settings-smoke.js
node tests/fb-admin-dreamhome-parent-detail-child-window-polish-smoke.js
```

Hai regression đầu pass. Regression `fb-admin-dreamhome-parent-detail-child-window-polish-smoke.js` đã chạy nhưng fail ở assertion Settings class day checkbox label/id hiện có trong `src/settings-module.js`, ngoài phạm vi F23.3B CRM shell nên chưa sửa trong phase này.

Build/check:

```txt
npm run build
git diff --check
```
