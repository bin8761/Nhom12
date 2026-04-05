type PasswordChangeResult = 'success' | 'failure';
type PasswordResetRequestResult = 'sent' | 'ignored' | 'rate_limited';
type PasswordResetResult = 'success' | 'failure';
export declare function recordPasswordChange(result: PasswordChangeResult): void;
export declare function recordPasswordResetRequest(result: PasswordResetRequestResult): void;
export declare function recordPasswordResetResult(result: PasswordResetResult): void;
export {};
//# sourceMappingURL=passwordMetrics.d.ts.map