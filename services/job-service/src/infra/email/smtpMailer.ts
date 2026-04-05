import nodemailer, { Transporter } from 'nodemailer';
import { loadAppConfig } from '../../config/appConfig';

let transporter: Transporter | null = null;

export function initMailerTransport(): Transporter {
  if (transporter) {
    return transporter;
  }

  const {
    mail: {
      smtp: { host, port, secure, username, password },
    },
  } = loadAppConfig();

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: username && password ? { user: username, pass: password } : undefined,
    // Force UTF-8 encoding for all emails
    defaults: {
      encoding: 'utf-8',
    },
  });

  transporter.on('error', (error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[Mailer] transport error', error);
    }
  });

  return transporter;
}

function getTransporter(): Transporter {
  if (!transporter) {
    return initMailerTransport();
  }

  return transporter;
}

export async function shutdownMailerTransport(): Promise<void> {
  if (!transporter) {
    return;
  }

  const candidate = transporter as Transporter & { close?: (cb?: () => void) => void };
  if (typeof candidate.close === 'function') {
    await new Promise<void>((resolve) => {
      candidate.close?.(() => resolve());
    }).catch(() => undefined);
  }
  transporter = null;
}

const getMailConfig = () => loadAppConfig().mail;

export async function sendVerificationEmail(params: {
  to: string;
  code: string;
  userId: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = 'Mã xác minh email';
  const text = `Xin chào,

Mã xác minh của bạn là: ${params.code}
Mã có hiệu lực trong thời gian giới hạn. Vui lòng không chia sẻ mã này với bất kỳ ai.

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    text,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  code: string;
  userId: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = 'Mã đặt lại mật khẩu';
  const text = `Xin chào,

Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
Mã đặt lại mật khẩu là: ${params.code}
Mã sẽ hết hạn sau 1 phút. Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email.

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    text,
  });
}

export async function sendEmployerApprovedEmail(params: {
  userId: string;
  to: string;
  approvedBy: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = 'Tài khoản nhà tuyển dụng đã được duyệt';
  const text = `Xin chào,

Tài khoản nhà tuyển dụng của bạn đã được duyệt thành công!

Bạn có thể bắt đầu sử dụng các tính năng:
- Đăng tin tuyển dụng
- Xem hồ sơ ứng viên
- Quản lý ứng tuyển

Chúc bạn sớm tìm được ứng viên phù hợp.

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    text,
  });
}

export async function sendEmployerPendingReviewEmail(params: {
  userId: string;
  to: string;
  reason: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = 'Tài khoản nhà tuyển dụng đang được xem xét';
  const text = `Xin chào,

Tài khoản nhà tuyển dụng của bạn đang được đội ngũ chúng tôi xem xét.
Lý do: ${params.reason}

Chúng tôi sẽ thông báo ngay khi có kết quả (thường trong 1-2 ngày làm việc).

Cảm ơn bạn đã kiên nhẫn!

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    text,
  });
}

export async function sendJobApprovedEmail(params: {
  to: string;
  jobTitle: string;
  jobId: string;
  slug?: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = 'Tin tuyển dụng của bạn đã được duyệt';
  const text = `Xin chào,

Tin tuyển dụng "${params.jobTitle}" của bạn đã được duyệt và đang hiển thị cho ứng viên.

Chúc bạn sớm tìm được ứng viên phù hợp!

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    text,
  });
}

export async function sendJobRejectedEmail(params: {
  to: string;
  jobTitle: string;
  jobId: string;
  slug?: string;
  note: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = 'Tin tuyển dụng của bạn bị từ chối';
  const note = params.note || 'Không có lý do cụ thể.';
  const text = `Xin chào,

Tin tuyển dụng "${params.jobTitle}" chưa thể được duyệt.

Lý do: ${note}

Vui lòng chỉnh sửa nội dung tin và gửi lại để được xem xét nhanh hơn.

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    text,
  });
}

export async function sendCandidateCvDecisionEmail(params: {
  to: string;
  candidateName?: string;
  jobTitle: string;
  status: 'APPROVED' | 'REJECTED';
  note?: string | null;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();
  const approved = params.status === 'APPROVED';

  const subject = approved ? 'CV của bạn đã được duyệt' : 'CV của bạn chưa được duyệt';
  const greeting = `Xin chào${params.candidateName ? ` ${params.candidateName}` : ''},`;
  const noteText = params.note ? `<br><strong>Ghi chú:</strong> ${params.note}` : '';

  const body = approved
    ? `Nhà tuyển dụng đã phê duyệt CV của bạn cho vị trí "<strong>${params.jobTitle}</strong>".${noteText}<br><br>Chúng tôi sẽ liên hệ nếu có bước tiếp theo.`
    : `Nhà tuyển dụng chưa thể phê duyệt CV của bạn cho vị trí "<strong>${params.jobTitle}</strong>".${noteText}<br><br>Bạn có thể cập nhật hồ sơ và ứng tuyển lại khi sẵn sàng.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <p>${greeting}</p>
    <p>${body}</p>
    <p>Trân trọng,<br>Đội ngũ hỗ trợ</p>
  </div>
</body>
</html>`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    html,
  });
}

export async function sendNewApplicationNotificationEmail(params: {
  to: string;
  jobTitle: string;
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  applicationId: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = `Có ứng viên mới ứng tuyển vào "${params.jobTitle}"`;
  
  const candidateInfo = [];
  if (params.candidateName) candidateInfo.push(`<li><strong>Họ tên:</strong> ${params.candidateName}</li>`);
  if (params.candidateEmail) candidateInfo.push(`<li><strong>Email:</strong> ${params.candidateEmail}</li>`);
  if (params.candidatePhone) candidateInfo.push(`<li><strong>Số điện thoại:</strong> ${params.candidatePhone}</li>`);
  
  const candidateDetails = candidateInfo.length > 0 
    ? `<p><strong>Thông tin ứng viên:</strong></p><ul style="list-style: none; padding-left: 0;">${candidateInfo.join('')}</ul>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <p>Xin chào,</p>
    <p>Bạn có một ứng viên mới ứng tuyển vào vị trí "<strong>${params.jobTitle}</strong>".</p>
    ${candidateDetails}
    <p>Vui lòng đăng nhập vào hệ thống để xem chi tiết hồ sơ và CV của ứng viên.</p>
    <p>Trân trọng,<br>Đội ngũ hỗ trợ</p>
  </div>
</body>
</html>`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    html,
  });
}

export async function sendJobDeletedNotificationEmail(params: {
  to: string;
  candidateName?: string;
  jobTitle: string;
  reason?: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = `Tin tuyển dụng "${params.jobTitle}" đã bị xóa`;
  const greeting = `Xin chào${params.candidateName ? ` ${params.candidateName}` : ''},`;
  
  const reasonText = params.reason 
    ? `<p><strong>Lý do:</strong> ${params.reason}</p>` 
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <p>${greeting}</p>
    <p>Chúng tôi xin thông báo rằng tin tuyển dụng "<strong>${params.jobTitle}</strong>" mà bạn đã ứng tuyển đã bị xóa.</p>
    ${reasonText}
    <p>Đơn ứng tuyển của bạn cũng đã bị hủy. Nếu tin tuyển dụng được khôi phục, bạn có thể ứng tuyển lại.</p>
    <p>Chúng tôi xin lỗi vì sự bất tiện này và mong bạn tiếp tục tìm kiếm các cơ hội việc làm khác trên hệ thống.</p>
    <p>Trân trọng,<br>Đội ngũ hỗ trợ</p>
  </div>
</body>
</html>`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    html,
  });
}

export async function sendJobDeletedByAdminEmail(params: {
  to: string;
  jobTitle: string;
  jobId: string;
  reason: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = `Tin tuyển dụng "${params.jobTitle}" đã bị xóa bởi Admin`;

  const text = `Xin chào,

Chúng tôi xin thông báo rằng tin tuyển dụng "${params.jobTitle}" của bạn đã bị Admin xóa khỏi hệ thống.

Lý do xóa:
${params.reason}

Nếu bạn có bất kỳ thắc mắc nào về quyết định này, vui lòng liên hệ với đội ngũ hỗ trợ của chúng tôi.

Trân trọng,
Đội ngũ hỗ trợ`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #dc2626;">Tin tuyển dụng đã bị xóa</h2>
    <p>Xin chào,</p>
    <p>Chúng tôi xin thông báo rằng tin tuyển dụng "<strong>${params.jobTitle}</strong>" của bạn đã bị Admin xóa khỏi hệ thống.</p>
    
    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Lý do xóa:</strong></p>
      <p style="margin: 10px 0 0 0;">${params.reason}</p>
    </div>

    <p>Nếu bạn có bất kỳ thắc mắc nào về quyết định này, vui lòng liên hệ với đội ngũ hỗ trợ của chúng tôi.</p>
    
    <p>Trân trọng,<br>Đội ngũ hỗ trợ</p>
  </div>
</body>
</html>`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    text,
    html,
  });
}

export async function sendJobUpdatePendingEmail(params: {
  to: string;
  jobTitle: string;
  jobId: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = 'Tin tuyển dụng đang chờ duyệt lại';
  const text = `Xin chào,

Tin tuyển dụng "${params.jobTitle}" của bạn đã được cập nhật thành công.

Tin của bạn hiện đang chờ admin phê duyệt lại và sẽ được hiển thị công khai sau khi được duyệt.

Chúng tôi sẽ thông báo ngay khi tin của bạn được phê duyệt (thường trong 1-2 ngày làm việc).

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    text,
  });
}

export async function sendJobUnavailableEmail(params: {
  to: string;
  candidateName?: string;
  jobTitle: string;
  locale?: string;
}): Promise<void> {
  const transport = getTransporter();
  const mail = getMailConfig();

  const subject = `Thông báo cập nhật về tin tuyển dụng "${params.jobTitle}"`;
  const greeting = `Xin chào${params.candidateName ? ` ${params.candidateName}` : ''},`;

  const text = `${greeting}

Tin tuyển dụng "${params.jobTitle}" mà bạn đã ứng tuyển hiện đang được nhà tuyển dụng cập nhật.

Tin này tạm thời không còn hiển thị công khai cho đến khi được admin duyệt lại.

Đơn ứng tuyển của bạn vẫn được giữ nguyên và chúng tôi sẽ thông báo cho bạn khi có cập nhật mới.

Cảm ơn bạn đã kiên nhẫn!

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: mail.sender,
    to: params.to,
    subject,
    text,
  });
}
