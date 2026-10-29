# Lớp học trực tuyến

Trang web tĩnh (HTML/CSS/JS) với hai vai trò: **học sinh** và **admin**.

## Tính năng
- Admin: thêm môn, bật/tắt môn hiển thị cho học sinh, gắn link YouTube bài giảng, tạo bài thi (số phút, lịch thi, câu hỏi trắc nghiệm), xem kết quả.
- Học sinh: tạo tài khoản, xem môn được mở, xem video bài giảng ngay trên web, làm bài thi có đồng hồ đếm ngược (hết giờ tự nộp), xem lịch kiểm tra.

## Đưa lên GitHub Pages
1. Tạo repo mới trên GitHub, tải 4 file (`index.html`, `style.css`, `app.js`, `README.md`) lên nhánh `main`.
2. Vào **Settings → Pages → Build and deployment**, chọn *Deploy from a branch*, nhánh `main`, thư mục `/ (root)`, rồi Save.
3. Sau 1–2 phút, trang chạy tại `https://<tên-github>.github.io/<tên-repo>/`.

## Tài khoản admin
Mặc định `admin` / `admin123`. **Hãy đổi ở đầu file `app.js` trước khi công khai.**

## Giới hạn quan trọng
GitHub Pages không có máy chủ, nên dữ liệu đang lưu trong `localStorage` của **từng trình duyệt**: admin tạo môn trên máy nào thì chỉ máy đó thấy. Mật khẩu admin nằm trong mã nguồn nên ai cũng đọc được.
Để học sinh ở máy khác thấy dữ liệu của admin, cần nối backend (ví dụ Firebase hoặc Supabase): thay hàm `load` và `save` trong `app.js`. Khi đó cũng nên dùng đăng nhập thật thay cho mật khẩu cố định.
