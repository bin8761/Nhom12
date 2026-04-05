type UserRole = 'candidate' | 'employer' | 'admin';
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
interface GenerateTokenParams {
    userId: string;
    email: string;
    role: UserRole;
    deviceId: string;
    emailVerified: boolean;
    approvalStatus?: ApprovalStatus;
}
export interface GeneratedAuthTokens {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
    refreshTokenExpiresAt: Date;
    refreshTokenJti: string;
}
export declare function resolvePublicKey(): string | undefined;
export declare function generateAuthTokens(params: GenerateTokenParams): GeneratedAuthTokens;
export {};
//# sourceMappingURL=tokenGenerator.d.ts.map