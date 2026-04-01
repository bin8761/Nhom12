"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authTokensResponseSchema = exports.meResponseSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.changePasswordSchema = exports.resendPhoneOtpRequestSchema = exports.verifyPhoneRequestSchema = exports.verifyEmailRequestSchema = exports.resendVerificationRequestSchema = exports.logoutRequestSchema = exports.refreshRequestSchema = exports.loginRequestSchema = exports.registerRequestSchema = void 0;
const zod_1 = require("zod");
const validation_1 = require("../utils/validation");
const emailSchema = zod_1.z
    .string({ required_error: 'Email là bắt buộc' })
    .email('Email phải là địa chỉ email hợp lệ');
const passwordSchema = zod_1.z
    .string({ required_error: 'Mật khẩu là bắt buộc' })
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự');
const strongPasswordSchema = zod_1.z
    .string({ required_error: 'Mật khẩu là bắt buộc' })
    .min(10, 'Mật khẩu phải có ít nhất 10 ký tự')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Mật khẩu phải chứa ít nhất một chữ cái và một số');
const deviceIdSchema = zod_1.z
    .string({ required_error: 'Mã thiết bị là bắt buộc' })
    .min(1, 'Mã thiết bị là bắt buộc');
const refreshTokenSchema = zod_1.z
    .string({ required_error: 'Refresh token là bắt buộc' })
    .min(1, 'Refresh token không được để trống');
const userRoleSchema = zod_1.z.enum(['candidate', 'employer', 'admin']);
const registerRoleSchema = zod_1.z.enum(['candidate', 'employer']);
const positiveIntegerSchema = zod_1.z
    .number()
    .int('Giá trị phải là số nguyên')
    .positive('Giá trị phải là số dương');
const phoneNumberSchema = zod_1.z
    .string({ required_error: 'Số điện thoại là bắt buộc' })
    .regex(/^(\+?84|0)(\d{9})$/, 'Số điện thoại phải là số điện thoại Việt Nam hợp lệ');
const verificationCodeSchema = zod_1.z
    .string({ required_error: 'Mã xác thực là bắt buộc' })
    .min(6, 'Mã xác thực phải có 6 ký tự')
    .max(6, 'Mã xác thực phải có 6 ký tự');
const fullNameSchema = zod_1.z
    .string({ required_error: 'Họ và tên là bắt buộc' })
    .min(1, 'Họ và tên là bắt buộc')
    .max(120, 'Họ và tên không được vượt quá 120 ký tự');
const addressSchema = zod_1.z
    .string({ required_error: 'Địa chỉ là bắt buộc' })
    .min(1, 'Địa chỉ là bắt buộc')
    .max(255, 'Địa chỉ không được vượt quá 255 ký tự');
const dateOfBirthSchema = zod_1.z
    .string({ required_error: 'Ngày sinh là bắt buộc' })
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Ngày sinh phải có định dạng dd/MM/yyyy')
    .refine((value) => (0, validation_1.isAdult)(value), 'Bạn phải đủ 18 tuổi trở lên');
exports.registerRequestSchema = zod_1.z.object({
    email: emailSchema,
    password: strongPasswordSchema,
    role: registerRoleSchema,
    deviceId: deviceIdSchema.optional(),
    fullName: fullNameSchema,
    dateOfBirth: dateOfBirthSchema,
    address: addressSchema,
    phoneNumber: phoneNumberSchema,
    companyName: zod_1.z.string().optional(),
    companyWebsite: zod_1.z.string().url('Website công ty phải là URL hợp lệ').optional().or(zod_1.z.literal('')),
});
exports.loginRequestSchema = zod_1.z.object({
    email: emailSchema,
    password: passwordSchema,
    deviceId: deviceIdSchema,
});
exports.refreshRequestSchema = zod_1.z.object({
    refreshToken: refreshTokenSchema,
    deviceId: deviceIdSchema,
});
exports.logoutRequestSchema = zod_1.z.object({
    deviceId: deviceIdSchema,
});
exports.resendVerificationRequestSchema = zod_1.z.object({
    email: emailSchema,
});
exports.verifyEmailRequestSchema = zod_1.z.object({
    email: emailSchema,
    code: verificationCodeSchema,
});
exports.verifyPhoneRequestSchema = zod_1.z.object({
    phoneNumber: phoneNumberSchema,
    code: verificationCodeSchema,
});
exports.resendPhoneOtpRequestSchema = zod_1.z.object({
    phoneNumber: phoneNumberSchema,
});
exports.changePasswordSchema = zod_1.z
    .object({
    currentPassword: passwordSchema,
    newPassword: strongPasswordSchema,
})
    .refine((data) => data.currentPassword !== data.newPassword, { message: 'Mật khẩu mới phải khác mật khẩu hiện tại', path: ['newPassword'] });
exports.forgotPasswordSchema = zod_1.z.object({
    email: emailSchema,
});
exports.resetPasswordSchema = zod_1.z.object({
    email: emailSchema,
    code: verificationCodeSchema,
    newPassword: strongPasswordSchema,
});
exports.meResponseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('ID người dùng phải là UUID hợp lệ'),
    email: emailSchema,
    role: userRoleSchema,
    emailVerified: zod_1.z.boolean(),
    fullName: fullNameSchema,
    dateOfBirth: dateOfBirthSchema,
    address: addressSchema,
    phoneNumber: phoneNumberSchema,
    phoneVerified: zod_1.z.boolean(),
});
exports.authTokensResponseSchema = zod_1.z.object({
    accessToken: zod_1.z.string({ required_error: 'Access token là bắt buộc' }),
    refreshToken: zod_1.z.string({ required_error: 'Refresh token là bắt buộc' }),
    tokenType: zod_1.z.string().default('Bearer'),
    expiresIn: positiveIntegerSchema,
    refreshTokenExpiresIn: positiveIntegerSchema,
    phoneVerificationRequired: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=authSchemas.js.map