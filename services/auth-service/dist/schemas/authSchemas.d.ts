import { z } from 'zod';
export declare const registerRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodEnum<["candidate", "employer"]>;
    deviceId: z.ZodOptional<z.ZodString>;
    fullName: z.ZodString;
    dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
    address: z.ZodString;
    phoneNumber: z.ZodString;
    companyName: z.ZodOptional<z.ZodString>;
    companyWebsite: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, "strip", z.ZodTypeAny, {
    password?: string;
    role?: "employer" | "candidate";
    email?: string;
    phoneNumber?: string;
    address?: string;
    dateOfBirth?: string;
    fullName?: string;
    deviceId?: string;
    companyName?: string;
    companyWebsite?: string;
}, {
    password?: string;
    role?: "employer" | "candidate";
    email?: string;
    phoneNumber?: string;
    address?: string;
    dateOfBirth?: string;
    fullName?: string;
    deviceId?: string;
    companyName?: string;
    companyWebsite?: string;
}>;
export declare const loginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    deviceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password?: string;
    email?: string;
    deviceId?: string;
}, {
    password?: string;
    email?: string;
    deviceId?: string;
}>;
export declare const refreshRequestSchema: z.ZodObject<{
    refreshToken: z.ZodString;
    deviceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken?: string;
    deviceId?: string;
}, {
    refreshToken?: string;
    deviceId?: string;
}>;
export declare const logoutRequestSchema: z.ZodObject<{
    deviceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceId?: string;
}, {
    deviceId?: string;
}>;
export declare const resendVerificationRequestSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
}, {
    email?: string;
}>;
export declare const verifyEmailRequestSchema: z.ZodObject<{
    email: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code?: string;
    email?: string;
}, {
    code?: string;
    email?: string;
}>;
export declare const verifyPhoneRequestSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code?: string;
    phoneNumber?: string;
}, {
    code?: string;
    phoneNumber?: string;
}>;
export declare const resendPhoneOtpRequestSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phoneNumber?: string;
}, {
    phoneNumber?: string;
}>;
export declare const changePasswordSchema: z.ZodEffects<z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword?: string;
    newPassword?: string;
}, {
    currentPassword?: string;
    newPassword?: string;
}>, {
    currentPassword?: string;
    newPassword?: string;
}, {
    currentPassword?: string;
    newPassword?: string;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
}, {
    email?: string;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    email: z.ZodString;
    code: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code?: string;
    email?: string;
    newPassword?: string;
}, {
    code?: string;
    email?: string;
    newPassword?: string;
}>;
export declare const meResponseSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    role: z.ZodEnum<["candidate", "employer", "admin"]>;
    emailVerified: z.ZodBoolean;
    fullName: z.ZodString;
    dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
    address: z.ZodString;
    phoneNumber: z.ZodString;
    phoneVerified: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    role?: "employer" | "candidate" | "admin";
    id?: string;
    email?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
    address?: string;
    dateOfBirth?: string;
    fullName?: string;
    phoneVerified?: boolean;
}, {
    role?: "employer" | "candidate" | "admin";
    id?: string;
    email?: string;
    phoneNumber?: string;
    emailVerified?: boolean;
    address?: string;
    dateOfBirth?: string;
    fullName?: string;
    phoneVerified?: boolean;
}>;
export declare const authTokensResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodString;
    tokenType: z.ZodDefault<z.ZodString>;
    expiresIn: z.ZodNumber;
    refreshTokenExpiresIn: z.ZodNumber;
    phoneVerificationRequired: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    accessToken?: string;
    refreshToken?: string;
    tokenType?: string;
    expiresIn?: number;
    refreshTokenExpiresIn?: number;
    phoneVerificationRequired?: boolean;
}, {
    accessToken?: string;
    refreshToken?: string;
    tokenType?: string;
    expiresIn?: number;
    refreshTokenExpiresIn?: number;
    phoneVerificationRequired?: boolean;
}>;
export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
export type RefreshRequestInput = z.infer<typeof refreshRequestSchema>;
export type LogoutRequestInput = z.infer<typeof logoutRequestSchema>;
export type ResendVerificationRequestInput = z.infer<typeof resendVerificationRequestSchema>;
export type VerifyEmailRequestInput = z.infer<typeof verifyEmailRequestSchema>;
export type VerifyPhoneRequestInput = z.infer<typeof verifyPhoneRequestSchema>;
export type ResendPhoneOtpRequestInput = z.infer<typeof resendPhoneOtpRequestSchema>;
export type ChangePasswordRequestInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordSchema>;
export type AuthTokensResponse = z.infer<typeof authTokensResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
//# sourceMappingURL=authSchemas.d.ts.map