export interface SendPhoneVerificationSmsPayload {
    userId: string;
    phoneNumber: string;
    code: string;
}
export declare function sendPhoneVerificationSms(payload: SendPhoneVerificationSmsPayload): Promise<void>;
//# sourceMappingURL=smsProvider.d.ts.map