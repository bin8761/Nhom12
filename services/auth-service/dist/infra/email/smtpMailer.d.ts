export declare function sendVerificationEmail(params: {
    to: string;
    code: string;
    userId: string;
    locale?: string;
}): Promise<void>;
export declare function sendPasswordResetEmail(params: {
    to: string;
    code: string;
    userId: string;
    locale?: string;
}): Promise<void>;
export declare function sendEmployerApprovedEmail(params: {
    userId: string;
    to: string;
    approvedBy: string;
    locale?: string;
}): Promise<void>;
export declare function sendEmployerPendingReviewEmail(params: {
    userId: string;
    to: string;
    reason: string;
    locale?: string;
}): Promise<void>;
//# sourceMappingURL=smtpMailer.d.ts.map