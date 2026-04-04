# Tính năng Phân tích CV bằng AI (Gemini)

## 📋 Tổng quan

Hệ thống đã được nâng cấp với tính năng phân tích CV tự động sử dụng **Google Gemini AI**. Khi ứng viên upload CV (PDF), AI sẽ tự động:
- Trích xuất thông tin cá nhân
- Phân tích kỹ năng và kinh nghiệm
- Đánh giá chất lượng CV
- Đưa ra feedback chi tiết bằng tiếng Việt

---

## 🎯 Các tính năng chính

### 1. **Phân tích tự động**
- Upload CV PDF → AI tự động phân tích trong vài giây
- Trích xuất thông tin có cấu trúc
- Không cần nhập thủ công

### 2. **Thông tin được trích xuất**
- ✅ Thông tin cá nhân: Họ tên, Email, Số điện thoại
- ✅ Số năm kinh nghiệm
- ✅ Kỹ năng (Skills)
- ✅ Học vấn (Education): Trường, Bằng cấp, Năm tốt nghiệp
- ✅ Kinh nghiệm làm việc (Experience): Vị trí, Công ty, Thời gian, Mô tả
- ✅ Chứng chỉ (Certificates)
- ✅ Hoạt động (Activities)
- ✅ Mục tiêu nghề nghiệp (Objective)
- ✅ Tóm tắt (Summary)
- ✅ **Đánh giá từ AI (AI Feedback)** - Điểm mạnh/yếu của CV

### 3. **Giao diện hiển thị**

#### Cho Ứng viên (Trang CV Management):
- Hiển thị đầy đủ thông tin đã phân tích
- AI Feedback nổi bật với icon 🤖
- Phân loại theo từng mục với màu sắc riêng
- Dễ đọc, trực quan

#### Cho Nhà tuyển dụng (Trang Applications):
- Xem nhanh thông tin ứng viên (compact view)
- Nút "Xem chi tiết đầy đủ" mở modal
- Modal hiển thị toàn bộ thông tin CV
- Có thể xem PDF gốc hoặc thông tin đã phân tích

---

## 🚀 Cách sử dụng

### Đối với Ứng viên:

1. **Upload CV:**
   - Vào trang "Quản lý CV"
   - Chọn file PDF (tối đa 10MB)
   - Click "Upload"

2. **Xem kết quả:**
   - Đợi vài giây để AI phân tích
   - Xem thông tin đã trích xuất
   - Đọc feedback từ AI để cải thiện CV

### Đối với Nhà tuyển dụng:

1. **Xem danh sách ứng viên:**
   - Vào "Danh sách ứng viên" của công việc
   - Xem thông tin tóm tắt của từng ứng viên

2. **Xem chi tiết CV:**
   - Click "Xem chi tiết đầy đủ"
   - Đọc AI Feedback để đánh giá nhanh
   - Xem PDF gốc nếu cần

3. **Đưa ra quyết định:**
   - Dựa trên thông tin đã phân tích
   - Chấp nhận hoặc từ chối ứng viên
   - Chat trực tiếp với ứng viên

---

## 🎨 Màu sắc và Icon

| Mục | Icon | Màu |
|-----|------|-----|
| AI Feedback | 🤖 | Purple/Blue gradient |
| Thông tin cơ bản | 📋 | Blue |
| Mục tiêu | 🎯 | Green |
| Tóm tắt | 📝 | Amber |
| Kỹ năng | 🔧 | Indigo |
| Học vấn | 🎓 | Cyan |
| Kinh nghiệm | 💼 | Emerald |
| Chứng chỉ | 🏆 | Rose |
| Hoạt động | 🎭 | Violet |

---

## 🔧 Cấu hình Backend

### Environment Variables:
```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_REQUEST_TIMEOUT_MS=60000
```

### Queue Configuration:
- **Queue Name:** `cvProcessingQueue`
- **Concurrency:** 2 jobs đồng thời
- **Retry:** 3 lần với exponential backoff
- **DLQ:** `cvProcessingQueue.dlq` cho failed jobs

---

## 📊 Workflow

```
1. Ứng viên upload CV (PDF)
   ↓
2. Virus scan (ClamAV)
   ↓
3. Lưu file vào storage
   ↓
4. Tạo job trong queue (BullMQ)
   ↓
5. Worker xử lý:
   - Upload file lên Gemini API
   - Gửi prompt phân tích
   - Nhận kết quả JSON
   - Parse và validate
   - Lưu vào database
   ↓
6. Publish event "cv_parsed"
   ↓
7. Frontend hiển thị kết quả
```

---

## 🐛 Xử lý lỗi

### Các trường hợp lỗi:
1. **Upload thất bại:** Hiển thị lỗi, cho phép upload lại
2. **Virus detected:** Từ chối file, thông báo cho user
3. **AI parsing failed:** Retry 3 lần, sau đó chuyển vào DLQ
4. **Timeout:** Retry với backoff

### Status của CV:
- `PENDING`: Chờ xử lý
- `PARSING`: Đang phân tích
- `PARSED`: Thành công
- `FAILED`: Thất bại (hiển thị error message)

---

## 📈 Metrics & Monitoring

### Metrics được track:
- `cv_upload_size_bytes`: Kích thước file upload
- `cv_upload_total`: Số lượng upload (success/failed)
- `cv_parse_duration_seconds`: Thời gian phân tích
- `cv_parse_result_total`: Kết quả phân tích (success/error)
- `cv_queue_depth`: Số job đang chờ trong queue
- `cv_dlq_total`: Số job vào DLQ

---

## 🔐 Bảo mật

- ✅ Virus scan trước khi xử lý
- ✅ Validate file type (chỉ PDF)
- ✅ Giới hạn kích thước (10MB)
- ✅ Signed URL cho download (TTL: 5 phút)
- ✅ Authentication required
- ✅ Authorization check (chỉ owner hoặc admin)

---

## 🎓 Best Practices

### Cho Ứng viên:
1. Upload CV rõ ràng, có cấu trúc
2. Sử dụng font chữ chuẩn
3. Tránh dùng hình ảnh thay text
4. Đọc AI Feedback để cải thiện CV

### Cho Nhà tuyển dụng:
1. Đọc AI Feedback trước khi quyết định
2. Kết hợp xem PDF gốc và thông tin đã phân tích
3. Sử dụng thông tin để lọc ứng viên nhanh hơn

---

## 📝 Changelog

### Version 1.0 (2024-11-29)
- ✅ Tích hợp Gemini AI
- ✅ Phân tích CV tự động
- ✅ AI Feedback tiếng Việt
- ✅ UI/UX mới cho hiển thị CV
- ✅ Modal xem chi tiết
- ✅ Component ParsedCvDisplay
- ✅ Metrics và monitoring
- ✅ Error handling và retry logic

---

## 🔮 Tính năng tương lai

- [ ] So sánh CV với Job Description
- [ ] Scoring tự động (0-100)
- [ ] Gợi ý câu hỏi phỏng vấn
- [ ] Export CV sang format khác
- [ ] Bulk analysis cho nhiều CV
- [ ] AI chatbot tư vấn CV

---

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Check logs trong console
2. Xem error message trên UI
3. Liên hệ team dev với thông tin:
   - CV ID
   - Error message
   - Timestamp
   - Screenshot (nếu có)
