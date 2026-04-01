import type { AuthTokensResponse, LoginRequestInput, LogoutRequestInput, RefreshRequestInput, RegisterRequestInput, ResendVerificationRequestInput, ResendPhoneOtpRequestInput, ForgotPasswordRequestInput, ResetPasswordRequestInput, VerifyEmailRequestInput, VerifyPhoneRequestInput, MeResponse } from '../schemas/authSchemas';
export interface RegisterContext {
    ipAddress?: string | null;
    userAgent?: string | null;
    locale?: string | null;
}
export interface LoginContext {
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
}
export interface RefreshContext {
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
}
export interface ResendVerificationContext {
    ipAddress?: string | null;
    userAgent?: string | null;
    locale?: string | null;
    requestId?: string | null;
}
export interface LogoutContext {
    userId?: string | null;
    userEmail?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
}
export interface VerifyPhoneContext {
    userId?: string | null;
    requestId?: string | null;
}
export interface ResendPhoneVerificationContext {
    userId?: string | null;
    requestId?: string | null;
}
export interface RequestPasswordResetContext {
    requestId?: string | null;
    locale?: string | null;
}
export interface ChangePasswordContext {
    userId?: string | null;
    requestId?: string | null;
}
export interface ResetPasswordContext {
    requestId?: string | null;
}
export declare function register(input: RegisterRequestInput, context?: RegisterContext): Promise<AuthTokensResponse>;
export declare function login(input: LoginRequestInput, context?: LoginContext): Promise<AuthTokensResponse>;
export declare function refresh(input: RefreshRequestInput, context?: RefreshContext): Promise<AuthTokensResponse>;
export declare function resendVerification(input: ResendVerificationRequestInput, context?: ResendVerificationContext): Promise<void>;
export declare function verifyEmail(input: VerifyEmailRequestInput): Promise<void>;
export declare function resendPhoneVerification(input: ResendPhoneOtpRequestInput, context?: ResendPhoneVerificationContext): Promise<void>;
export declare function verifyPhone(input: VerifyPhoneRequestInput, context?: VerifyPhoneContext): Promise<void>;
export declare function getCurrentUserProfile(userId: string): Promise<MeResponse>;
export declare function changePassword(context: ChangePasswordContext, currentPassword: string, newPassword: string): Promise<void>;
export declare function requestPasswordReset(input: ForgotPasswordRequestInput, context?: RequestPasswordResetContext): Promise<void>;
export declare function resetPassword(input: ResetPasswordRequestInput, context?: ResetPasswordContext): Promise<void>;
export declare function logout(input: LogoutRequestInput, context?: LogoutContext): Promise<void>;
//# sourceMappingURL=auth.service.d.ts.map