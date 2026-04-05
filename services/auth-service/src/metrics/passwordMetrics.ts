import { Counter, register } from 'prom-client';

type PasswordChangeResult = 'success' | 'failure';
type PasswordResetRequestResult = 'sent' | 'ignored' | 'rate_limited';
type PasswordResetResult = 'success' | 'failure';

const passwordChangeCounter =
  (register.getSingleMetric('password_change_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'password_change_total',
    help: 'Total password change attempts',
    labelNames: ['result'],
  });

if (!register.getSingleMetric('password_change_total')) {
  register.registerMetric(passwordChangeCounter);
}

const passwordResetRequestCounter =
  (register.getSingleMetric('password_reset_request_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'password_reset_request_total',
    help: 'Total password reset requests',
    labelNames: ['result'],
  });

if (!register.getSingleMetric('password_reset_request_total')) {
  register.registerMetric(passwordResetRequestCounter);
}

const passwordResetResultCounter =
  (register.getSingleMetric('password_reset_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'password_reset_total',
    help: 'Total password reset attempts processed',
    labelNames: ['result'],
  });

if (!register.getSingleMetric('password_reset_total')) {
  register.registerMetric(passwordResetResultCounter);
}

export function recordPasswordChange(result: PasswordChangeResult): void {
  try {
    passwordChangeCounter.labels(result).inc();
  } catch {
    // swallow metrics errors to avoid impacting main flow
  }
}

export function recordPasswordResetRequest(result: PasswordResetRequestResult): void {
  try {
    passwordResetRequestCounter.labels(result).inc();
  } catch {
    // swallow metrics errors to avoid impacting main flow
  }
}

export function recordPasswordResetResult(result: PasswordResetResult): void {
  try {
    passwordResetResultCounter.labels(result).inc();
  } catch {
    // swallow metrics errors to avoid impacting main flow
  }
}
