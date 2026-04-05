type PositiveInteger = number;
export interface RedisConfig {
    url: string;
}
export interface EmailVerificationConfig {
    codeTtlMinutes: PositiveInteger;
    maxPendingAgeHours: PositiveInteger;
}
export interface AuthRateLimitConfig {
    registerPerMinute: PositiveInteger;
    loginPerMinute: PositiveInteger;
    resendPerHour: PositiveInteger;
    phoneOtpPerHour: PositiveInteger;
    refreshPerMinute: PositiveInteger;
}
export interface AuthTokenConfig {
    accessTokenTtlSeconds: PositiveInteger;
    refreshTokenTtlDays: PositiveInteger;
}
export interface NotificationServiceConfig {
    baseUrl: string;
    defaultLocale: string;
}
export interface EmployerApprovalConfig {
    autoApproveEnabled: boolean;
    delaySeconds: number;
    trustedDomains: string[];
    blockedDomains: string[];
}
export interface JwtConfig {
    privateKey?: string;
    publicKey?: string;
    issuer: string;
    audience: string;
    algorithm: 'RS256';
}
export interface JobServiceConfig {
    baseUrl: string;
    internalSecret: string;
}
export interface EventBusConfig {
    url: string;
}
export interface AppConfig {
    environment: string;
    redis: RedisConfig;
    emailVerification: EmailVerificationConfig;
    rateLimit: AuthRateLimitConfig;
    authTokens: AuthTokenConfig;
    notificationService: NotificationServiceConfig;
    employerApproval: EmployerApprovalConfig;
    jwt: JwtConfig;
    jobService: JobServiceConfig;
    eventBus: EventBusConfig;
}
export declare function loadAppConfig(): AppConfig;
export declare function resetAppConfigCache(): void;
export {};
//# sourceMappingURL=appConfig.d.ts.map