import { Counter, register } from 'prom-client';

export type PhoneOtpSource = 'register' | 'resend' | 'other';
export type PhoneOtpFailureReason =
  | 'phone_mismatch'
  | 'record_not_found'
  | 'expired'
  | 'invalid_code'
  | 'lockout'
  | 'send_failed'
  | 'worker_error'
  | 'other';

const phoneOtpSentCounter =
  (register.getSingleMetric('phone_verification_sent_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'phone_verification_sent_total',
    help: 'Total number of phone verification OTPs sent',
    labelNames: ['source'],
  });

if (!register.getSingleMetric('phone_verification_sent_total')) {
  register.registerMetric(phoneOtpSentCounter);
}

const phoneOtpVerifiedCounter =
  (register.getSingleMetric('phone_verification_verified_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'phone_verification_verified_total',
    help: 'Total number of phone verification OTPs successfully verified',
    labelNames: ['source'],
  });

if (!register.getSingleMetric('phone_verification_verified_total')) {
  register.registerMetric(phoneOtpVerifiedCounter);
}

const phoneOtpFailedCounter =
  (register.getSingleMetric('phone_verification_failed_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'phone_verification_failed_total',
    help: 'Total number of failed phone verification attempts',
    labelNames: ['reason'],
  });

if (!register.getSingleMetric('phone_verification_failed_total')) {
  register.registerMetric(phoneOtpFailedCounter);
}

const phoneOtpWorkerFailureCounter =
  (register.getSingleMetric('phone_verification_worker_failed_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'phone_verification_worker_failed_total',
    help: 'Total number of phone verification worker failures',
    labelNames: ['reason'],
  });

if (!register.getSingleMetric('phone_verification_worker_failed_total')) {
  register.registerMetric(phoneOtpWorkerFailureCounter);
}

function getSourceLabel(source?: PhoneOtpSource): PhoneOtpSource {
  if (source === 'register' || source === 'resend') {
    return source;
  }
  return 'other';
}

export function recordPhoneOtpSent(source?: PhoneOtpSource): void {
  try {
    phoneOtpSentCounter.labels(getSourceLabel(source)).inc();
  } catch {
    // swallow metrics errors
  }
}

export function recordPhoneOtpVerified(source?: PhoneOtpSource): void {
  try {
    phoneOtpVerifiedCounter.labels(getSourceLabel(source)).inc();
  } catch {
    // swallow metrics errors
  }
}

export function recordPhoneOtpFailed(reason: PhoneOtpFailureReason): void {
  try {
    phoneOtpFailedCounter.labels(reason).inc();
  } catch {
    // swallow metrics errors
  }
}

export function recordPhoneOtpWorkerFailed(reason: PhoneOtpFailureReason): void {
  try {
    phoneOtpWorkerFailureCounter.labels(reason).inc();
  } catch {
    // swallow metrics errors
  }
}
