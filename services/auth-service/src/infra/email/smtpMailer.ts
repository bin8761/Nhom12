import nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

function loadSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'no-reply@example.com';

  if (!host) {
    throw new Error('SMTP_HOST is required');
  }

  return { host, port, secure, user, pass, from };
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  const cfg = loadSmtpConfig();
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
    // Force UTF-8 encoding for all emails
    defaults: {
      encoding: 'utf-8',
    },
  });
  return transporter;
}

export async function sendVerificationEmail(params: {
  to: string;
  code: string;
  userId: string;
  locale?: string;
}): Promise<void> {
  const cfg = loadSmtpConfig();
  const transport = getTransporter();

  const subject = 'Mã xác minh email';
  const text = `Xin chào,

Mã xác minh của bạn là: ${params.code}
Mã có hiệu lực trong thời gian giới hạn. Vui lòng không chia sẻ mã này với bất kỳ ai.

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: cfg.from,
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
  const cfg = loadSmtpConfig();
  const transport = getTransporter();

  const subject = 'Mã đặt lại mật khẩu';
  const text = `Xin chào,

Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
Mã đặt lại mật khẩu là: ${params.code}
Mã sẽ hết hạn sau 1 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: cfg.from,
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
  const cfg = loadSmtpConfig();
  const transport = getTransporter();

  const subject = 'Tài khoản nhà tuyển dụng đã được duyệt';
  const text = `Xin chào,

Tài khoản nhà tuyển dụng của bạn đã được duyệt thành công!

Bạn có thể bắt đầu sử dụng các tính năng:
- Đăng tin tuyển dụng
- Xem hồ sơ ứng viên
- Quản lý ứng tuyển

Cảm ơn bạn đã đồng hành cùng chúng tôi.

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: cfg.from,
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
  const cfg = loadSmtpConfig();
  const transport = getTransporter();

  const subject = 'Tài khoản nhà tuyển dụng đang được xem xét';
  const text = `Xin chào,

Tài khoản nhà tuyển dụng của bạn đang được đội ngũ chúng tôi xem xét.
Lý do: ${params.reason}

Chúng tôi sẽ thông báo ngay khi có kết quả. Quá trình này thường mất 1-2 ngày làm việc.

Cảm ơn bạn đã kiên nhẫn!

Trân trọng,
Đội ngũ hỗ trợ`;

  await transport.sendMail({
    from: cfg.from,
    to: params.to,
    subject,
    text,
  });
}


