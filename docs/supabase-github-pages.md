# Supabase trên GitHub Pages

## Mục đích

Khi chạy local, Vite đọc cấu hình Supabase từ `.env.local`. File này không được commit.

GitHub Pages build ứng dụng trong GitHub Actions, vì vậy workflow phải nhận cấu hình Supabase tại thời điểm chạy `npm run build`. Repo sử dụng workflow:

```txt
.github/workflows/deploy.yml
```

Workflow lấy hai giá trị từ GitHub Actions repository secrets:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

## Tạo repository secrets

1. Mở repository GitHub.
2. Chọn **Settings**.
3. Chọn **Secrets and variables** → **Actions**.
4. Trong **Repository secrets**, tạo:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Giá trị:

- `VITE_SUPABASE_URL`: Supabase Project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase API Keys → Publishable key.

Không đưa giá trị thật vào source code, tài liệu hoặc workflow.

## Không sử dụng

Không tạo hoặc truyền key đặc quyền phía server, khóa bí mật quản trị hoặc
thông tin đăng nhập database vào frontend.

Biến có tiền tố `VITE_` được nhúng vào JavaScript khi build và có thể được trình duyệt đọc. Chỉ publishable key được phép dùng theo cách này.

## Deploy

Workflow chạy khi push lên nhánh `main` hoặc khi chạy thủ công bằng **Actions** → **Deploy iChess Center OS to GitHub Pages** → **Run workflow**.

Build sử dụng:

```yaml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
```

Vite đang dùng base path:

```txt
/ichess-center-os/
```

phù hợp với:

```txt
https://vesperkrock.github.io/ichess-center-os/
```

## Kiểm tra sau deploy

1. Mở `https://vesperkrock.github.io/ichess-center-os/`.
2. Mở Module **Thu chi**.
3. Panel Supabase Cloud phải hiện **Supabase đã cấu hình**.
4. Đăng nhập bằng Supabase Auth user.
5. Kiểm tra cơ sở **DreamHome** và role `owner` hoặc `admin`.
6. Kiểm tra danh sách ảnh giao dịch cloud tháng hiện tại.
7. Bấm **Xem ảnh** và xác nhận signed URL mở được ảnh trong private bucket.

Nếu panel hiện **Chưa cấu hình Supabase**, kiểm tra:

- Hai repository secrets có đúng tên hay không.
- Workflow mới nhất đã chạy lại sau khi tạo secrets hay chưa.
- Bước **Build site** có hoàn thành hay không.

## Ghi chú bảo mật

- Publishable key được thiết kế để dùng trong frontend.
- RLS và Storage policies phải kiểm soát quyền truy cập dữ liệu.
- Bucket `transaction-images` phải giữ ở chế độ private.
- Signed URL chỉ có hiệu lực trong thời gian giới hạn.
- `.env.local` phải tiếp tục nằm trong `.gitignore`.
- Không log hoặc hiển thị key trong UI.
- Deploy GitHub Pages thực tế chỉ được coi là pass sau khi workflow Actions
  chạy thành công và người dùng kiểm tra đăng nhập, RLS cùng signed URL trên
  URL Pages.
