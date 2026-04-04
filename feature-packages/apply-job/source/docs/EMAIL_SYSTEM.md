# HỆ THỐNG GỬI EMAIL - TÀI LIỆU CHI TIẾT

## Mục lục
1. [Tổng quan](#tổng-quan)
2. [Cấu hình SMTP](#cấu-hình-smtp)
3. [Danh sách Email Templates](#danh-sách-email-templates)
4. [Flow gửi email theo nghiệp vụ](#flow-gửi-email-theo-nghiệp-vụ)
5. [Xử lý lỗi](#xử-lý-lỗi)

---

## Tổng quan

Hệ thống sử dụng **Nodemailer** để gửi email qua SMTP server. Email được gửi trong các trường hợp:
- Xác thực tài khoản
- Thông báo trạng thái tin tuyển dụng
- Thông báo ứng tuyển
- Thông báo quyết định CV

**Services có chức năng gửi email:**
- `auth-service`: Xác thực, đăng ký, reset password
- `job-service`: Tin tuyển dụng, ứng tuyển, CV

---

## Cấu hình SMTP

### Auth Service
```env
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@example.com
```

### Job Service
```env
MAIL_SENDER=no-reply@bonenet.local
MAIL_SMTP_HOST=127.0.0.1
MAIL_SMTP_PORT=1025
MAIL_SMTP_SECURE=false
MAIL_SMTP_USERNAME=
MAIL_SMTP_PASSWORD=
```

**Lưu ý:**
- Development: Dùng MailHog (port 1025) để test email
- Production: Cần cấu hình SMTP thật (Gmail, SendGrid, AWS SES...)

---

## Danh sách Email Templates

### 1. AUTH SERVICE

#### 1.1. Email xác minh tài khoản
**Function:** `sendVerificationEmail()`
**Khi nào gửi:** User đăng ký tài khoản mới
**Người nhận:** User vừa đăng ký
**Nội dung:**
- Mã xác minh (6 số)
- Thời gian hiệu lực
- Cảnh báo không chia sẻ mã

**Ví dụ:**
```
Subject: Mã xác minh email
Body:
Xin chào,

Mã xác minh của bạn là: 123456
Mã có hiệu lực trong thời gian giới hạn. Vui lòng không chia sẻ mã này với bất kỳ ai.

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 1.2. Email đặt lại mật khẩu
**Function:** `sendPasswordResetEmail()`
**Khi nào gửi:** User yêu cầu reset password
**Người nhận:** User yêu cầu reset
**Nội dung:**
- Mã reset password (6 số)
- Thời gian hết hạn: 1 phút
- Hướng dẫn bỏ qua nếu không yêu cầu

**Ví dụ:**
```
Subject: Mã đặt lại mật khẩu
Body:
Xin chào,

Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
Mã đặt lại mật khẩu là: 789012
Mã sẽ hết hạn sau 1 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 1.3. Email duyệt tài khoản Employer
**Function:** `sendEmployerApprovedEmail()`
**Khi nào gửi:** Admin duyệt tài khoản employer
**Người nhận:** Employer được duyệt
**Nội dung:**
- Thông báo đã được duyệt
- Danh sách tính năng có thể sử dụng
- Lời chúc mừng

**Ví dụ:**
```
Subject: Tài khoản nhà tuyển dụng đã được duyệt
Body:
Xin chào,

Tài khoản nhà tuyển dụng của bạn đã được duyệt thành công!

Bạn có thể bắt đầu sử dụng các tính năng:
- Đăng tin tuyển dụng
- Xem hồ sơ ứng viên
- Quản lý ứng tuyển

Cảm ơn bạn đã đồng hành cùng chúng tôi.

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 1.4. Email tài khoản Employer đang xem xét
**Function:** `sendEmployerPendingReviewEmail()`
**Khi nào gửi:** Admin đặt tài khoản employer về PENDING
**Người nhận:** Employer bị pending
**Nội dung:**
- Thông báo đang xem xét
- Lý do
- Thời gian xử lý dự kiến

**Ví dụ:**
```
Subject: Tài khoản nhà tuyển dụng đang được xem xét
Body:
Xin chào,

Tài khoản nhà tuyển dụng của bạn đang được đội ngũ chúng tôi xem xét.
Lý do: Cần xác minh thông tin công ty

Chúng tôi sẽ thông báo ngay khi có kết quả. Quá trình này thường mất 1-2 ngày làm việc.

Cảm ơn bạn đã kiên nhẫn!

Trân trọng,
Đội ngũ hỗ trợ
```

---

### 2. JOB SERVICE

#### 2.1. Email tin tuyển dụng được duyệt
**Function:** `sendJobApprovedEmail()`
**Khi nào gửi:** Admin duyệt tin tuyển dụng
**Người nhận:** Employer đăng tin
**Nội dung:**
- Tên tin tuyển dụng
- Thông báo đã được duyệt
- Lời chúc

**Ví dụ:**
```
Subject: Tin tuyển dụng của bạn đã được duyệt
Body:
Xin chào,

Tin tuyển dụng "Senior Node.js Engineer" của bạn đã được duyệt và đang hiển thị cho ứng viên.

Chúc bạn sớm tìm được ứng viên phù hợp!

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 2.2. Email tin tuyển dụng bị từ chối
**Function:** `sendJobRejectedEmail()`
**Khi nào gửi:** Admin từ chối tin tuyển dụng
**Người nhận:** Employer đăng tin
**Nội dung:**
- Tên tin tuyển dụng
- Lý do từ chối
- Hướng dẫn chỉnh sửa và gửi lại

**Ví dụ:**
```
Subject: Tin tuyển dụng của bạn bị từ chối
Body:
Xin chào,

Tin tuyển dụng "Senior Node.js Engineer" chưa thể được duyệt.

Lý do: Mô tả công việc quá ngắn, thiếu thông tin về yêu cầu kỹ năng

Vui lòng chỉnh sửa nội dung tin và gửi lại để được xem xét nhanh hơn.

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 2.3. Email tin tuyển dụng đang chờ duyệt lại
**Function:** `sendJobUpdatePendingEmail()`
**Khi nào gửi:** Employer cập nhật tin đã APPROVED
**Người nhận:** Employer cập nhật tin
**Nội dung:**
- Tên tin tuyển dụng
- Thông báo đang chờ duyệt lại
- Thời gian xử lý dự kiến

**Ví dụ:**
```
Subject: Tin tuyển dụng đang chờ duyệt lại
Body:
Xin chào,

Tin tuyển dụng "Senior Node.js Engineer" của bạn đã được cập nhật thành công.

Tin của bạn hiện đang chờ admin phê duyệt lại và sẽ được hiển thị công khai sau khi được duyệt.

Chúng tôi sẽ thông báo ngay khi tin của bạn được phê duyệt (thường trong 1-2 ngày làm việc).

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 2.4. Email tin tuyển dụng bị xóa bởi Admin
**Function:** `sendJobDeletedByAdminEmail()`
**Khi nào gửi:** Admin xóa tin tuyển dụng
**Người nhận:** Employer đăng tin
**Nội dung:**
- Tên tin tuyển dụng
- Lý do xóa (chi tiết)
- Hướng dẫn liên hệ support

**Ví dụ:**
```
Subject: Tin tuyển dụng "Senior Node.js Engineer" đã bị xóa bởi Admin
Body:
Xin chào,

Chúng tôi xin thông báo rằng tin tuyển dụng "Senior Node.js Engineer" của bạn đã bị Admin xóa khỏi hệ thống.

Lý do xóa:
Nội dung vi phạm chính sách: Yêu cầu ứng viên nộp phí

Nếu bạn có bất kỳ thắc mắc nào về quyết định này, vui lòng liên hệ với đội ngũ hỗ trợ của chúng tôi.

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 2.5. Email thông báo ứng viên mới
**Function:** `sendNewApplicationNotificationEmail()`
**Khi nào gửi:** Candidate ứng tuyển vào tin
**Người nhận:** Employer đăng tin
**Nội dung:**
- Tên tin tuyển dụng
- Thông tin ứng viên (tên, email, SĐT)
- Hướng dẫn xem chi tiết

**Ví dụ:**
```
Subject: Có ứng viên mới ứng tuyển vào "Senior Node.js Engineer"
Body:
Xin chào,

Bạn có một ứng viên mới ứng tuyển vào vị trí "Senior Node.js Engineer".

Thông tin ứng viên:
- Họ tên: Nguyễn Văn A
- Email: nguyenvana@gmail.com
- Số điện thoại: 0123456789

Vui lòng đăng nhập vào hệ thống để xem chi tiết hồ sơ và CV của ứng viên.

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 2.6. Email quyết định CV
**Function:** `sendCandidateCvDecisionEmail()`
**Khi nào gửi:** Employer duyệt/từ chối CV của candidate
**Người nhận:** Candidate ứng tuyển
**Nội dung:**
- Tên tin tuyển dụng
- Kết quả (APPROVED/REJECTED)
- Ghi chú từ employer (nếu có)

**Ví dụ (APPROVED):**
```
Subject: CV của bạn đã được duyệt
Body:
Xin chào Nguyễn Văn A,

Nhà tuyển dụng đã phê duyệt CV của bạn cho vị trí "Senior Node.js Engineer".

Ghi chú: Hồ sơ rất ấn tượng, chúng tôi sẽ liên hệ để sắp xếp phỏng vấn

Chúng tôi sẽ liên hệ nếu có bước tiếp theo.

Trân trọng,
Đội ngũ hỗ trợ
```

**Ví dụ (REJECTED):**
```
Subject: CV của bạn chưa được duyệt
Body:
Xin chào Nguyễn Văn A,

Nhà tuyển dụng chưa thể phê duyệt CV của bạn cho vị trí "Senior Node.js Engineer".

Ghi chú: Kinh nghiệm chưa đủ yêu cầu

Bạn có thể cập nhật hồ sơ và ứng tuyển lại khi sẵn sàng.

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 2.7. Email tin tuyển dụng bị xóa (thông báo cho candidate)
**Function:** `sendJobDeletedNotificationEmail()`
**Khi nào gửi:** Employer xóa tin tuyển dụng
**Người nhận:** Tất cả candidate đã ứng tuyển
**Nội dung:**
- Tên tin tuyển dụng
- Thông báo tin đã bị xóa
- Thông báo đơn ứng tuyển bị hủy

**Ví dụ:**
```
Subject: Tin tuyển dụng "Senior Node.js Engineer" đã bị xóa
Body:
Xin chào Nguyễn Văn A,

Chúng tôi xin thông báo rằng tin tuyển dụng "Senior Node.js Engineer" mà bạn đã ứng tuyển đã bị xóa.

Đơn ứng tuyển của bạn cũng đã bị hủy. Nếu tin tuyển dụng được khôi phục, bạn có thể ứng tuyển lại.

Chúng tôi xin lỗi vì sự bất tiện này và mong bạn tiếp tục tìm kiếm các cơ hội việc làm khác trên hệ thống.

Trân trọng,
Đội ngũ hỗ trợ
```

---

#### 2.8. Email tin tuyển dụng đang cập nhật (thông báo cho candidate)
**Function:** `sendJobUnavailableEmail()`
**Khi nào gửi:** Employer cập nhật tin đã APPROVED
**Người nhận:** Tất cả candidate đã ứng tuyển
**Nội dung:**
- Tên tin tuyển dụng
- Thông báo tin đang cập nhật
- Đảm bảo đơn ứng tuyển vẫn còn

**Ví dụ:**
```
Subject: Thông báo cập nhật về tin tuyển dụng "Senior Node.js Engineer"
Body:
Xin chào Nguyễn Văn A,

Tin tuyển dụng "Senior Node.js Engineer" mà bạn đã ứng tuyển hiện đang được nhà tuyển dụng cập nhật.

Tin này tạm thời không còn hiển thị công khai cho đến khi được admin duyệt lại.

Đơn ứng tuyển của bạn vẫn được giữ nguyên và chúng tôi sẽ thông báo cho bạn khi có cập nhật mới.

Cảm ơn bạn đã kiên nhẫn!

Trân trọng,
Đội ngũ hỗ trợ
```

---

## Flow gửi email theo nghiệp vụ

### Flow 1: Đăng ký tài khoản
```
1. User đăng ký → sendVerificationEmail()
2. User nhập mã xác minh → Tài khoản active
```

### Flow 2: Reset password
```
1. User yêu cầu reset → sendPasswordResetEmail()
2. User nhập mã → Đổi password thành công
```

### Flow 3: Đăng ký Employer
```
1. User đăng ký role EMPLOYER → Tài khoản PENDING
2. Admin duyệt → sendEmployerApprovedEmail()
   HOẶC
   Admin pending → sendEmployerPendingReviewEmail()
```

### Flow 4: Đăng tin tuyển dụng
```
1. Employer đăng tin → Tin PENDING
2. Admin duyệt → sendJobApprovedEmail()
   HOẶC
   Admin từ chối → sendJobRejectedEmail()
```

### Flow 5: Cập nhật tin tuyển dụng
```
1. Employer cập nhật tin APPROVED → Tin về PENDING
2. sendJobUpdatePendingEmail() → Employer
3. sendJobUnavailableEmail() → Tất cả candidate đã ứng tuyển
4. Admin duyệt lại → sendJobApprovedEmail()
```

### Flow 6: Xóa tin tuyển dụng
```
A. Employer tự xóa:
   1. Employer xóa tin → Tin DELETED
   2. sendJobDeletedNotificationEmail() → Tất cả candidate đã ứng tuyển

B. Admin xóa:
   1. Admin xóa tin (kèm lý do) → Tin DELETED
   2. sendJobDeletedByAdminEmail() → Employer
   3. sendJobDeletedNotificationEmail() → Tất cả candidate đã ứng tuyển
```

### Flow 7: Ứng tuyển
```
1. Candidate ứng tuyển → Application SUBMITTED
2. sendNewApplicationNotificationEmail() → Employer
3. Employer duyệt/từ chối CV → sendCandidateCvDecisionEmail() → Candidate
```

---

## Xử lý lỗi

### Logging
Tất cả email đều có logging:
- **Trước khi gửi:** Log event `*_sending_email`
- **Sau khi gửi thành công:** Log event `*_email_sent`
- **Khi gửi thất bại:** Log event `*_email_failed` (kèm stack trace)

### Retry
- Hiện tại: **KHÔNG có retry tự động**
- Email thất bại sẽ bị mất
- Cần implement retry queue (Bull/BullMQ) nếu cần

### Fallback
- Nếu email thất bại, hệ thống vẫn hoạt động bình thường
- User không nhận được thông báo qua email
- Cần có notification trong app để backup

---

## Cải tiến trong tương lai

### 1. Email Queue
- Sử dụng Bull/BullMQ để queue email
- Retry tự động khi thất bại
- Rate limiting để tránh spam

### 2. Email Templates
- Sử dụng template engine (Handlebars, EJS)
- Tách HTML template ra file riêng
- Hỗ trợ đa ngôn ngữ tốt hơn

### 3. Email Tracking
- Track email đã gửi/đã đọc
- Lưu lịch sử email trong database
- Dashboard thống kê email

### 4. Email Provider
- Hỗ trợ nhiều provider (SendGrid, AWS SES, Mailgun)
- Fallback khi provider chính down
- A/B testing email templates

---

## Tổng kết

**Tổng số email templates: 12**
- Auth Service: 4 templates
- Job Service: 8 templates

**Người nhận email:**
- User/Candidate: 7 templates
- Employer: 5 templates

**Trigger gửi email:**
- User action: 3 templates (đăng ký, reset password, ứng tuyển)
- Admin action: 5 templates (duyệt employer, duyệt tin, từ chối tin, xóa tin)
- System action: 4 templates (cập nhật tin, xóa tin, thông báo ứng viên)

---

**Ngày tạo:** 25/11/2025  
**Phiên bản:** 1.0  
**Tác giả:** Development Team


---

## Lịch sử cập nhật

### Version 1.1 - 30/11/2025
**Fix encoding UTF-8 cho tất cả emails**
- **Vấn đề:** Chữ tiếng Việt có dấu bị lỗi hiển thị trong email (ví dụ: "Phú?c Sang" thay vì "Phước Sang")
- **Giải pháp:** Thêm `defaults: { encoding: 'utf-8' }` vào Nodemailer config
- **Files đã fix:**
  + `services/auth-service/src/infra/email/smtpMailer.ts`
  + `services/job-service/src/infra/email/smtpMailer.ts`
- **Áp dụng cho:** **TẤT CẢ 12 email templates**
  + Auth Service: 4 templates ✅
  + Job Service: 8 templates ✅
- **Lưu ý:** ⚠️ **CẦN RESTART cả 2 services** để áp dụng fix
  + `npm run dev` hoặc restart Docker containers
  + Chỉ ảnh hưởng emails gửi SAU KHI restart

---

**Phiên bản hiện tại:** 1.1  
**Cập nhật lần cuối:** 30/11/2025
