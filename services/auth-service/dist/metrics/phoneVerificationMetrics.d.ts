export type PhoneOtpSource = 'register' | 'resend' | 'other';
export type PhoneOtpFailureReason = 'phone_mismatch' | 'record_not_found' | 'expired' | 'invalid_code' | 'lockout' | 'send_failed' | 'worker_error' | 'other';
export declare function recordPhoneOtpSent(source?: PhoneOtpSource): void;
export declare function recordPhoneOtpVerified(source?: PhoneOtpSource): void;
export declare function recordPhoneOtpFailed(reason: PhoneOtpFailureReason): void;
export declare function recordPhoneOtpWorkerFailed(reason: PhoneOtpFailureReason): void;
//# sourceMappingURL=phoneVerificationMetrics.d.ts.map