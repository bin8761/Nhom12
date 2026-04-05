# ✅ Checklist Test Tính năng CV AI

## 🎯 Test nhanh (5 phút)

### 1. Test Upload CV (Ứng viên)
```
□ Vào trang /cv
□ Upload file PDF
□ Đợi status chuyển từ PARSING → PARSED
□ Kiểm tra hiển thị AI Feedback (🤖 màu tím)
□ Kiểm tra hiển thị đầy đủ các section
```

### 2. Test Xem CV (Nhà tuyển dụng)
```
□ Vào trang Applications của một job
□ Xem danh sách ứng viên
□ Kiểm tra hiển thị compact view
□ Click "Xem chi tiết đầy đủ"
□ Modal mở ra với thông tin đầy đủ
□ Click "Xem PDF gốc" (mở tab mới)
□ Đóng modal
```

---

## 🔍 Test chi tiết

### A. Trang CV Management (/cv)

#### Upload CV:
- [ ] Chọn file PDF (< 10MB)
- [ ] Upload thành công
- [ ] Hiển thị "Đang xử lý..." (status: PARSING)
- [ ] Sau vài giây chuyển sang "Đã xử lý" (status: PARSED)

#### Hiển thị thông tin:
- [ ] **AI Feedback** (🤖):
  - [ ] Hiển thị với background gradient purple-blue
  - [ ] Border màu tím đậm
  - [ ] Nội dung tiếng Việt, có đánh giá điểm mạnh/yếu
  
- [ ] **Thông tin cơ bản** (📋):
  - [ ] Họ tên
  - [ ] Email
  - [ ] Số điện thoại
  - [ ] Số năm kinh nghiệm (badge màu xanh)
  
- [ ] **Mục tiêu nghề nghiệp** (🎯):
  - [ ] Hiển thị nếu có
  - [ ] Background màu xanh lá nhạt
  
- [ ] **Tóm tắt** (📝):
  - [ ] Hiển thị nếu có
  - [ ] Background màu vàng nhạt
  
- [ ] **Kỹ năng** (🔧):
  - [ ] Hiển thị dạng badges
  - [ ] Màu indigo
  - [ ] Có thể wrap xuống dòng
  
- [ ] **Học vấn** (🎓):
  - [ ] Hiển thị từng entry
  - [ ] Có bằng cấp, trường, năm tốt nghiệp
  - [ ] Border-left màu cyan
  
- [ ] **Kinh nghiệm** (💼):
  - [ ] Hiển thị từng entry
  - [ ] Có vị trí, công ty, thời gian, mô tả
  - [ ] Border-left màu xanh lá
  
- [ ] **Chứng chỉ** (🏆):
  - [ ] Hiển thị dạng badges
  - [ ] Màu hồng
  
- [ ] **Hoạt động** (🎭):
  - [ ] Hiển thị dạng list
  - [ ] Màu tím

#### Actions:
- [ ] Nút "Xem" mở PDF trong tab mới
- [ ] Nút "Xóa" xóa CV thành công
- [ ] Sau xóa có thể upload CV mới

---

### B. Trang Applications (Nhà tuyển dụng)

#### Danh sách ứng viên:
- [ ] Hiển thị tên ứng viên (từ parsedFields.fullName)
- [ ] Hiển thị email, phone
- [ ] Hiển thị ngày ứng tuyển

#### Compact View:
- [ ] **AI Feedback** hiển thị (nếu có):
  - [ ] Background purple-50
  - [ ] Icon 🤖
  - [ ] Text bị cắt sau 3 dòng (line-clamp-3)
  
- [ ] **Thông tin cơ bản**:
  - [ ] Họ tên, email, phone
  - [ ] Số năm kinh nghiệm
  
- [ ] **Kỹ năng**:
  - [ ] Hiển thị dạng badges nhỏ
  
- [ ] **Học vấn**:
  - [ ] Hiển thị tóm tắt
  
- [ ] **Kinh nghiệm**:
  - [ ] Hiển thị tóm tắt
  
- [ ] **Chứng chỉ**:
  - [ ] Hiển thị dạng badges nhỏ

#### Nút "Xem chi tiết đầy đủ":
- [ ] Nút hiển thị ở cuối CV
- [ ] Click mở modal

#### Modal Chi tiết:
- [ ] **Header**:
  - [ ] Tiêu đề "Chi tiết CV - [Tên ứng viên]"
  - [ ] Nút "Xem PDF gốc" (nếu có)
  - [ ] Nút X để đóng
  
- [ ] **Content**:
  - [ ] Hiển thị đầy đủ như trang CV Management
  - [ ] Scroll được
  - [ ] Không bị tràn màn hình
  
- [ ] **Footer**:
  - [ ] Nút "Đóng"
  
- [ ] **Interactions**:
  - [ ] Click backdrop → đóng modal
  - [ ] Click nút X → đóng modal
  - [ ] Click nút "Đóng" → đóng modal
  - [ ] ESC key → đóng modal (nếu implement)

#### Actions:
- [ ] Nút "Xem PDF" mở PDF trong tab mới
- [ ] Nút "Chat" tạo conversation
- [ ] Nút "Chấp nhận" / "Từ chối" hoạt động

---

### C. Responsive Design

#### Desktop (> 1024px):
- [ ] Layout 2 cột cho thông tin cơ bản
- [ ] Modal rộng (max-w-4xl)
- [ ] Badges không bị wrap quá nhiều

#### Tablet (768px - 1024px):
- [ ] Layout 1 cột
- [ ] Modal vừa màn hình
- [ ] Scroll mượt

#### Mobile (< 768px):
- [ ] Layout 1 cột
- [ ] Modal full width với padding
- [ ] Text size đọc được
- [ ] Badges wrap xuống dòng
- [ ] Nút bấm đủ lớn

---

### D. Edge Cases

#### CV không có thông tin:
- [ ] Hiển thị "Ứng viên chưa cung cấp thông tin CV"
- [ ] Không crash

#### CV thiếu một số field:
- [ ] Chỉ hiển thị field có dữ liệu
- [ ] Không hiển thị section rỗng
- [ ] Không có lỗi console

#### AI Feedback dài:
- [ ] Compact view: Cắt sau 3 dòng
- [ ] Full view: Hiển thị đầy đủ
- [ ] Xuống dòng đúng (whitespace-pre-line)

#### Kỹ năng nhiều:
- [ ] Wrap xuống dòng
- [ ] Không bị tràn
- [ ] Scroll ngang nếu cần

#### Tên dài:
- [ ] Không bị cắt
- [ ] Wrap xuống dòng
- [ ] Không làm vỡ layout

---

### E. Performance

- [ ] Upload CV < 5s (với file 5MB)
- [ ] Parsing CV < 10s
- [ ] Modal mở nhanh (< 100ms)
- [ ] Scroll mượt
- [ ] Không lag khi có nhiều ứng viên

---

### F. Error Handling

#### Upload thất bại:
- [ ] Hiển thị error message
- [ ] Có thể thử lại
- [ ] File input reset

#### Parsing thất bại:
- [ ] Status: FAILED
- [ ] Hiển thị error message
- [ ] Có thể xóa và upload lại

#### Network error:
- [ ] Hiển thị error
- [ ] Có thể retry
- [ ] Không crash app

---

## 🎯 Acceptance Criteria

### Must Have:
- ✅ Hiển thị đầy đủ 14 fields
- ✅ AI Feedback nổi bật
- ✅ Compact view cho danh sách
- ✅ Modal chi tiết hoạt động
- ✅ Responsive trên mobile
- ✅ Không có lỗi TypeScript
- ✅ Không có lỗi console

### Nice to Have:
- ⭐ Animation khi mở modal
- ⭐ Loading skeleton
- ⭐ Copy to clipboard
- ⭐ Export CV
- ⭐ Print CV

---

## 🐛 Bug Report Template

Nếu phát hiện bug:

```
**Mô tả:**
[Mô tả ngắn gọn bug]

**Bước tái hiện:**
1. 
2. 
3. 

**Kết quả mong đợi:**
[Điều bạn mong đợi xảy ra]

**Kết quả thực tế:**
[Điều thực sự xảy ra]

**Screenshot:**
[Đính kèm nếu có]

**Environment:**
- Browser: 
- OS: 
- Screen size: 

**Console errors:**
[Copy paste lỗi từ console]
```

---

## ✅ Sign-off

Sau khi test xong:

- [ ] Tất cả test cases passed
- [ ] Không có bug critical
- [ ] Performance chấp nhận được
- [ ] UI/UX đẹp và dễ dùng
- [ ] Ready for production

**Tested by:** _______________  
**Date:** _______________  
**Signature:** _______________
