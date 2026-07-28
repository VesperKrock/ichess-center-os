# Design constraints — do not break

## Bất biến sản phẩm và bảo mật

1. Không đổi nghiệp vụ chỉ để UI đẹp hoặc ít bước hơn.
2. Không đổi role/action permission và không suy rộng owner thành platform-wide.
3. Không bỏ center isolation hoặc trộn dữ liệu/cache giữa cơ sở.
4. Không public hóa attachment nhân sự; không hiển thị raw path, token, URL tạm thời hoặc UUID kỹ thuật không cần thiết.
5. Không biến destructive action thành một cú bấm; giữ confirmation và hậu quả rõ ràng.
6. Không che loading, error, empty, stale, permission denied hoặc backend unavailable.
7. Không bỏ Start/taskbar/window semantics hoặc biến app thành dashboard thường nếu chưa được duyệt.
8. Không thiết kế permanent object deletion như capability khả dụng.
9. Không để masking/reveal state tồn tại sau close/reload/center switch/access loss.
10. Không làm mất version history, soft-removal meaning hoặc legal-hold state.
11. Không gộp Staff operational record với hồ sơ hành chính nhạy cảm.
12. Không thay source of truth hoặc hứa multi-device parity ở module chưa có cloud contract.

## Ma trận thay đổi

| Safe visual change | Needs technical review | Forbidden without product approval |
| --- | --- | --- |
| Token màu/spacing/radius/elevation cùng semantic | Đổi layout khiến DOM/action order thay đổi | Nới quyền role hoặc bỏ deny state |
| Chuẩn hóa icon, typography và button hierarchy | Đổi modal ↔ route/window/drawer | Public hóa hoặc persist URL/path/tệp private |
| Cải thiện alignment, wrapping và responsive stacking | Sticky/frozen row/column có thể ảnh hưởng scroll/focus | Bỏ center binding/isolation |
| Hợp nhất component style cho empty/loading/error | Cho phép nhiều instance cùng một module | Thêm permanent deletion UI |
| Thêm label/icon bổ trợ accessibility | Đổi keyboard interaction hoặc spreadsheet behavior | Bỏ confirmation/audit/legal hold |
| Dùng fixture giả an toàn trong Figma | Thêm density/theme preference được persist | Hardcode account/email làm quyền |
| Reorganize Figma pages/components | Đổi copy có ý nghĩa nghiệp vụ | Merge entity/source of truth |

## Destructive hierarchy bắt buộc

- Primary CTA không dùng cho action xóa/gỡ/archive nếu cùng screen có action lưu/tiếp tục.
- Confirmation phải nêu object bị tác động, điều gì được giữ, điều gì chưa xảy ra và khả năng phục hồi.
- Soft removal phải nói rõ object/history vẫn private và được giữ.
- `Approved` không đồng nghĩa `executed`; UI phải tách review state khỏi execution state.
- Legal hold phải nhìn thấy và chặn affordance liên quan; release hold không tự resume.

## Dữ liệu trong mockup

Dùng tên, số điện thoại, số giấy tờ, tài khoản ngân hàng, file và email hoàn toàn giả. Gắn note `DỮ LIỆU GIẢ — KHÔNG DÙNG THẬT` ở page mockup hoặc section fixture. Không copy record thật từ screenshot sang Figma nếu không cần; che trước khi upload ảnh cho GPT.
