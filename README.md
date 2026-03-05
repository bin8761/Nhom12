# 🚀 CloudUpload - Modern File Upload Interface

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

**CloudUpload** là một giao diện upload file hiện đại, đẹp mắt và thân thiện với người dùng. Được xây dựng với HTML5, CSS3, và vanilla JavaScript thuần túy, không phụ thuộc vào bất kỳ framework nào.

## ✨ Demo

![CloudUpload Preview](https://via.placeholder.com/800x450/1e1b4b/ffffff?text=CloudUpload+Demo)

## 🎯 Tính Năng Chính

### 🎨 Giao Diện & Thiết Kế
- ✅ **Ultra Modern UI** - Thiết kế hiện đại với glassmorphism và gradient
- ✅ **Dark Theme** - Giao diện tối mắt, sang trọng
- ✅ **Particle Effects** - 50+ hạt sáng tạo chiều sâu 3D
- ✅ **Animated Background** - 4 gradient spheres với animation xoay 360°
- ✅ **Neon Glow Effects** - Logo và icons phát sáng với pulse animation
- ✅ **Smooth Animations** - Cubic-bezier transitions mượt mà

### ⚡ Chức Năng
- 📤 **Drag & Drop** - Kéo thả file trực tiếp vào vùng upload
- 📁 **Multi-file Upload** - Hỗ trợ tải lên nhiều file cùng lúc
- 👁️ **File Preview** - Xem trước danh sách file với icon phù hợp
- 📊 **Upload Progress** - Thanh tiến trình với shine effect
- ✅ **Upload History** - Lưu lịch sử file đã tải lên
- 🔍 **File Type Detection** - Tự động nhận diện loại file
- 📏 **File Size Display** - Hiển thị kích thước file rõ ràng
- 🎉 **Success Confetti** - Hiệu ứng confetti khi upload thành công

### 🛡️ Bảo Mật & Tối Ưu
- 🔒 **XSS Protection** - Escape HTML để tránh tấn công XSS
- ⚡ **Fast Performance** - Tối ưu hiệu suất, load nhanh
- 📱 **Fully Responsive** - Tương thích mọi thiết bị
- 🌐 **Cross-browser** - Hỗ trợ tất cả trình duyệt hiện đại
- ♿ **Accessible** - Tuân thủ chuẩn accessibility

## 🚀 Bắt Đầu

### Yêu Cầu
- Trình duyệt web hiện đại (Chrome, Firefox, Safari, Edge)
- Không cần cài đặt thêm dependencies

### Cài Đặt

1. **Clone repository**
   ```bash
   git clone https://github.com/yourusername/Nhom12.git
   cd Nhom12
   ```

2. **Mở file index.html**
   ```bash
   # Windows
   start index.html
   
   # macOS
   open index.html
   
   # Linux
   xdg-open index.html
   ```

3. **Hoặc sử dụng Live Server** (VS Code Extension)
   - Cài đặt extension "Live Server"
   - Right-click vào `index.html`
   - Chọn "Open with Live Server"

## 📁 Cấu Trúc Dự Án

```
Nhom12/
│
├── index.html          # File HTML chính
├── styles.css          # CSS với animations và effects
├── script.js           # JavaScript logic và interactivity
└── README.md           # Documentation (file này)
```

## 🎨 Công Nghệ Sử Dụng

### Frontend
- **HTML5** - Cấu trúc semantic và modern
- **CSS3** - Glassmorphism, animations, và responsive design
- **JavaScript (ES6+)** - Vanilla JS thuần, không dùng framework

### Typography
- **Inter Font** - Google Font hiện đại, sắc nét

### Icons
- **Font Awesome 6.4** - Icon library đầy đủ

### Hiệu Ứng & Animation
- **CSS Animations** - Keyframes cho particles và spheres
- **CSS Transitions** - Cubic-bezier cho smooth transitions
- **JavaScript Animations** - Confetti effect và particle generation
- **Backdrop Filter** - Glassmorphism blur effect

## 💻 Cách Sử Dụng

### 1. Upload File

**Cách 1: Drag & Drop**
- Kéo file từ máy tính vào vùng upload (vùng có viền đứt nét)
- File sẽ tự động được thêm vào danh sách preview

**Cách 2: Browse File**
- Click nút "Chọn File từ Máy Tính"
- Chọn một hoặc nhiều file từ file explorer
- File sẽ hiển thị trong preview

### 2. Quản Lý File

- **Xem Preview**: Tất cả file được hiển thị với icon và size
- **Xóa File**: Click nút X màu đỏ bên cạnh file muốn xóa
- **Upload**: Click nút "Bắt Đầu Tải Lên" màu xanh

### 3. Theo Dõi Progress

- Thanh progress bar với phần trăm hoàn thành
- Hiển thị số lượng files đang upload
- Thông báo khi upload thành công

### 4. Lịch Sử Upload

- Xem danh sách file đã tải lên ở phần "File Đã Tải Lên"
- Mỗi file hiển thị tên, size, và thời gian upload
- Counter badge hiển thị tổng số file đã upload

## 🎨 Tùy Chỉnh

### Thay Đổi Màu Sắc

Chỉnh sửa file `styles.css` - phần `:root` variables:

```css
:root {
    --primary: #6366f1;      /* Màu chủ đạo */
    --secondary: #ec4899;    /* Màu phụ */
    --accent: #14b8a6;       /* Màu nhấn */
    --success: #10b981;      /* Màu thành công */
    --warning: #f59e0b;      /* Màu cảnh báo */
    --danger: #ef4444;       /* Màu nguy hiểm */
}
```

### Điều Chỉnh Animation Speed

Trong `styles.css`, tìm và chỉnh sửa:

```css
.gradient-sphere {
    animation: float 25s infinite ease-in-out; /* Thay đổi 25s */
}
```

### Thay Đổi Giới Hạn File Size

Trong `index.html`, chỉnh sửa text:

```html
<span>Tối đa 100MB</span> <!-- Thay đổi giới hạn -->
```

## 🌟 Features Chi Tiết

### Glassmorphism Effect
```css
background: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(30px);
border: 1px solid rgba(255, 255, 255, 0.15);
```

### Gradient Animation
```css
background: linear-gradient(135deg, #a855f7, #ec4899, #f59e0b);
animation: gradientShift 3s ease infinite;
background-size: 200% 200%;
```

### Particle System
- 50 particles với random size, position, và speed
- Float animation với translateY và opacity
- Random delay cho hiệu ứng tự nhiên

### Confetti Effect
- 100 confetti pieces khi upload thành công
- Random colors từ palette đã định nghĩa
- Rotate 720° khi rơi xuống

## 📱 Responsive Design

### Breakpoints
- **Desktop**: > 768px - Full features
- **Tablet**: 768px - Adjusted padding và font sizes
- **Mobile**: < 480px - Optimized cho màn hình nhỏ

### Mobile Optimizations
- Touch-friendly buttons (min 44px height)
- Larger tap targets
- Simplified animations
- Optimized font sizes

## 🔧 Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome  | 90+     | ✅ Full |
| Firefox | 88+     | ✅ Full |
| Safari  | 14+     | ✅ Full |
| Edge    | 90+     | ✅ Full |
| Opera   | 76+     | ✅ Full |

## 🐛 Known Issues

- [ ] Safari có thể có hiệu suất chậm hơn với backdrop-filter
- [ ] IE11 không được hỗ trợ (không support CSS Grid và modern features)

## 🤝 Đóng Góp

Contributions, issues và feature requests đều được chào đón!

1. Fork dự án
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📝 Changelog

### Version 1.0.0 (2026-03-05)
- ✨ Initial release
- 🎨 Ultra modern UI với glassmorphism
- ⚡ Drag & drop functionality
- 📊 Upload progress bar
- 🎉 Confetti success effect
- 📱 Fully responsive design
- 🔒 XSS protection

## 📄 License

Dự án này được phát hành dưới giấy phép [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 Nhom12

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software 
without restriction, including without limitation the rights to use, copy, 
modify, merge, publish, distribute, sublicense, and/or sell copies.
```

## 👥 Tác Giả

**Nhom12 Team**
- GitHub: [@Nhom12](https://github.com/Nhom12)

## 🙏 Cảm Ơn

- [Font Awesome](https://fontawesome.com/) - Icon library
- [Google Fonts](https://fonts.google.com/) - Inter font family
- [Glassmorphism](https://glassmorphism.com/) - Design inspiration

## 📞 Liên Hệ

Có câu hỏi? Hãy liên hệ:
- 📧 Email: toan22112004@gmail.com
- 💬 Issues: [GitHub Issues](https://github.com/Nhom12/issues)

---

<p align="center">
  Made with ❤️ by Nhom12 Team
</p>

<p align="center">
  ⭐ Star this repo if you like it!
</p>
