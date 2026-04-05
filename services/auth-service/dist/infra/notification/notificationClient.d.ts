interface VerificationEmailPayload {
    userId: string;
    email: string;
    verificationCode: string;
    locale?: string;
    requestId?: string;
}
export declare function sendVerificationEmail(payload: VerificationEmailPayload): Promise<void>;
export {};
//# sourceMappingURL=notificationClient.d.ts.map