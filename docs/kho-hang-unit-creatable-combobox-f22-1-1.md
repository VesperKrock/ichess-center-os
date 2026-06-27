# F22.1.1 - Kho hàng Đơn vị tính Creatable Combobox

## Summary

F22.1.1 là hotfix sau manual QA cho form thêm/sửa Kho hàng. Field "Đơn vị tính" không còn là select cứng; đã đổi sang input + datalist để người dùng vừa chọn gợi ý vừa gõ được đơn vị mới.

## Manual QA issue

- F22.1 đã đổi "Đơn vị tính" thành select/combobox, nhưng trải nghiệm vẫn là select cứng.
- User muốn giống "Cấp độ học" ở Module Học viên: có thể chọn option có sẵn hoặc gõ giá trị mới.

## Before/After

Before:

- "Đơn vị tính" là select cứng.
- User chỉ chọn được option có sẵn.
- Đơn vị mới như "Tập" không nhập trực tiếp được.

After:

- "Đơn vị tính" là input có `datalist`.
- User chọn được Cái, Chiếc, Bộ, Quyển, Hộp, Gói, Thùng, Đôi, Cuốn, Kg, Lít, Mét, Buổi, Khác.
- User gõ được đơn vị mới và lưu vào item.
- Unit cũ ngoài danh sách vẫn hiển thị đúng khi sửa.

## Pattern tham khảo

Hotfix dùng cùng pattern với "Cấp độ học" ở Module Học viên: `<input list="...">` kèm `<datalist>`.

## Data safety

- Preserve unit cũ ngoài danh sách.
- Cho phép unit mới, chỉ trim whitespace theo logic build item hiện có.
- Không đổi data model.
- Không xóa localStorage.
- Không seed dữ liệu.

## Scope không làm

- Không sửa Báo cáo F22.2.
- Không làm Nhân viên F22.3.
- Không làm Học phí/nối dây F22.4.
- Không SQL.
- Không Supabase data change.
- Không cloud/realtime kho.
- Không commit/push.

## Manual QA checklist

1. Mở Kho hàng.
2. Bấm "Thêm sản phẩm".
3. Ở "Đơn vị tính", chọn thử "Bộ".
4. Xóa và gõ đơn vị mới, ví dụ "Tập".
5. Lưu item test nếu cần: "QA F22.1.1 Unit Test".
6. Mở sửa lại item, kiểm tra "Đơn vị tính" vẫn là "Tập".
7. Reload app, dữ liệu không mất.

## Next phase

F22.3 - Nhân viên/chấm công MVP.
