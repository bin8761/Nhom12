import logger from '../../utils/logger';

export interface SendPhoneVerificationSmsPayload {
  userId: string;
  phoneNumber: string;
  code: string;
}

export async function sendPhoneVerificationSms(payload: SendPhoneVerificationSmsPayload): Promise<void> {
  // Stubbed SMS provider: log instead of calling a real gateway.
  if (process.env.NODE_ENV !== 'production') {
    logger.info({
      event: 'phone_verification_sms_debug',
      userId: payload.userId,
      phoneNumber: payload.phoneNumber,
      code: payload.code,
    });
  }
}
