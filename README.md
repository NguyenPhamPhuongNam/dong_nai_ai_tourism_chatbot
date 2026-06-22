# Đồng Nai Travel AI - Chatbot du lịch

Bộ này là ứng dụng chatbot du lịch dùng Google AI Studio / Gemini API và triển khai công khai bằng Netlify.

## Chức năng đã có
- Giới thiệu địa phương
- Gợi ý điểm tham quan
- Gợi ý ẩm thực
- Gợi ý lưu trú
- Gợi ý lịch trình du lịch

## Cách triển khai bằng Netlify
1. Vào Google AI Studio và tạo Gemini API key.
2. Tạo tài khoản Netlify.
3. Tạo repository GitHub mới rồi tải toàn bộ thư mục này lên repository đó.
4. Trong Netlify, chọn Add new site -> Import an existing project -> chọn repository.
5. Build command: npm run build
6. Publish directory: public
7. Functions directory: netlify/functions
8. Vào Site configuration -> Environment variables -> Add variable: GEMINI_API_KEY = API key lấy từ Google AI Studio.
9. Deploy lại website và mở link Netlify để thử chatbot.

## Lưu ý bảo mật
Không dán API key trực tiếp vào public/app.js hoặc index.html. API key phải nằm trong biến môi trường Netlify.
