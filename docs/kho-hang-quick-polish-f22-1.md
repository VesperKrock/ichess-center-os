# F22.1 - Kho hàng Quick Polish

## Summary

F22.1 xử lý nhanh nhóm feedback Kho hàng của anh Hải ngày 22/06: làm form thêm/sửa gọn hơn, chuẩn hóa wording theo hướng "Thêm sản phẩm", đổi "Đơn vị tính" thành combobox, và làm rõ ô tìm kiếm vật tư/tài sản/sản phẩm.

Phạm vi chỉ là polish UI/form trên prototype localStorage hiện có. Không đổi nghiệp vụ kho, không đổi model dữ liệu, không thêm cloud/realtime, không SQL, không thay dữ liệu Supabase.

## Feedback anh Hải được xử lý

- "Thêm vật tư" được chuẩn hóa thành CTA chính "Thêm sản phẩm".
- Search hiển thị rõ "Tìm vật tư/tài sản/sản phẩm".
- "Đơn vị tính" không còn là input text trống, đã chuyển thành combobox.
- Form thêm/sửa được thu gọn và sắp xếp lại nhóm field chính.
- Ngôn ngữ vẫn giữ đủ nghĩa vật tư/tài sản/sản phẩm để phù hợp cách vận hành cơ sở.

## Before/After

### Form gọn hơn

Before: form thêm/sửa có cảm giác dài, field đơn vị tính là text tự do, thứ tự field chưa thật ưu tiên thao tác nhanh.

After: form item dùng panel hẹp hơn, chiều cao tối đa thấp hơn, nhóm field chính nằm đầu form:

- Tên vật tư/tài sản/sản phẩm
- Nhóm
- Đơn vị tính
- Số lượng tồn
- Tình trạng
- Định mức tối thiểu
- Vị trí
- Ghi chú

### Đơn vị tính combobox

Before: "Đơn vị tính" là input text.

After F22.1: "Đơn vị tính" là combobox với các lựa chọn gợi ý.
Hotfix F22.1.1 đổi field này thành input + datalist để vừa chọn được vừa gõ được đơn vị mới.

- Cái
- Chiếc
- Bộ
- Quyển
- Hộp
- Gói
- Thùng
- Đôi
- Cuốn
- Kg
- Lít
- Mét
- Buổi
- Khác

Nếu dữ liệu cũ có đơn vị ngoài danh sách, form vẫn hiển thị giá trị đó và thêm vào gợi ý hiện tại để không làm mất giá trị cũ.

### Wording Thêm sản phẩm

Before: CTA chính dùng "Thêm vật tư".

After: CTA chính và nút lưu form tạo mới dùng "Thêm sản phẩm" / "Lưu sản phẩm". Các câu cần ngữ nghĩa rộng vẫn dùng "vật tư/tài sản/sản phẩm".

### Search vật tư/tài sản/sản phẩm

Before: placeholder search chung chung theo "Tên, nhóm, vị trí, ghi chú, tình trạng".

After: placeholder rõ hơn: "Tìm vật tư/tài sản/sản phẩm theo tên, nhóm, mã, vị trí". Filter vẫn giữ logic hiện có và bổ sung tìm theo mã item/id.

## Scope không làm

- Không realtime kho.
- Không cloud sync/realtime cho Kho hàng.
- Không cảnh báo cấp sách/áo trong phase này.
- Không làm Báo cáo F22.2.
- Không làm Nhân viên/chấm công F22.3.
- Không làm Học phí/nối dây học viên - phụ huynh - học phí F22.4.
- Không làm UI/icon/background F22.5.
- Không SQL.
- Không Supabase data change.
- Không commit/push.

## Data safety

- Không xóa localStorage.
- Không migrate hoặc viết lại dữ liệu kho hiện có.
- Không đổi key lưu trữ hoặc data model lớn.
- Đơn vị tính cũ được preserve: nếu item cũ có unit ngoài danh sách combobox, option đó vẫn hiển thị khi mở form sửa.
- Search chỉ đọc thêm mã item/id, không thay đổi dữ liệu.

## Manual QA checklist

1. Mở module Kho hàng.
2. Kiểm tra CTA chính hiển thị "Thêm sản phẩm".
3. Mở form thêm mới, kiểm tra form gọn và các field chính nằm đầu form.
4. Kiểm tra "Đơn vị tính" là combobox có thể chọn gợi ý và gõ đơn vị mới.
5. Chọn được Cái, Bộ, Quyển, Hộp, Gói và các option còn lại.
6. Tạo thử item tên "QA F22.1 Sản phẩm Test" nếu cần kiểm tra lưu localStorage.
7. Mở lại item vừa tạo để kiểm tra đơn vị tính không mất.
8. Search theo tên, nhóm, mã/id hoặc vị trí để kiểm tra placeholder và filter.
9. Search từ khóa không tồn tại để thấy empty state có nút "Thêm sản phẩm".
10. Reload app, dữ liệu localStorage không mất.
11. Kiểm tra nhanh các module Học viên/Giáo viên không bị ảnh hưởng.

## Next phase

F22.2 - Báo cáo ngày/tuần MVP.
