import { z } from 'zod';
import { isAdult } from '../utils/validation';

const emailSchema = z
  .string({ required_error: 'Email là bắt buộc' })
  .email('Email phải là địa chỉ email hợp lệ');

const passwordSchema = z
  .string({ required_error: 'Mật khẩu là bắt buộc' })
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự');

const strongPasswordSchema = z
  .string({ required_error: 'Mật khẩu là bắt buộc' })
  .min(10, 'Mật khẩu phải có ít nhất 10 ký tự')
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Mật khẩu phải chứa ít nhất một chữ cái và một số');

const deviceIdSchema = z
  .string({ required_error: 'Mã thiết bị là bắt buộc' })
  .min(1, 'Mã thiết bị là bắt buộc');

const refreshTokenSchema = z
  .string({ required_error: 'Refresh token là bắt buộc' })
  .min(1, 'Refresh token không được để trống');

const userRoleSchema = z.enum(['candidate', 'employer', 'admin']);
const registerRoleSchema = z.enum(['candidate', 'employer']);

const positiveIntegerSchema = z
  .number()
  .int('Giá trị phải là số nguyên')
  .positive('Giá trị phải là số dương');

const phoneNumberSchema = z
  .string({ required_error: 'Số điện thoại là bắt buộc' })
  .regex(/^(\+?84|0)(\d{9})$/, 'Số điện thoại phải là số điện thoại Việt Nam hợp lệ');

const verificationCodeSchema = z
  .string({ required_error: 'Mã xác thực là bắt buộc' })
  .min(6, 'Mã xác thực phải có 6 ký tự')
  .max(6, 'Mã xác thực phải có 6 ký tự');

const fullNameSchema = z
  .string({ required_error: 'Họ và tên là bắt buộc' })
  .min(1, 'Họ và tên là bắt buộc')
  .max(120, 'Họ và tên không được vượt quá 120 ký tự');

const addressSchema = z
  .string({ required_error: 'Địa chỉ là bắt buộc' })
  .min(1, 'Địa chỉ là bắt buộc')
  .max(255, 'Địa chỉ không được vượt quá 255 ký tự');

const dateOfBirthSchema = z
  .string({ required_error: 'Ngày sinh là bắt buộc' })
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Ngày sinh phải có định dạng dd/MM/yyyy')
  .refine((value) => isAdult(value), 'Bạn phải đủ 18 tuổi trở lên');

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
  role: registerRoleSchema,
  deviceId: deviceIdSchema.optional(),
  fullName: fullNameSchema,
  dateOfBirth: dateOfBirthSchema,
  address: addressSchema,
  phoneNumber: phoneNumberSchema,
  companyName: z.string().optional(),
  companyWebsite: z.string().url('Website công ty phải là URL hợp lệ').optional().or(z.literal('')),
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  deviceId: deviceIdSchema,
});

export const refreshRequestSchema = z.object({
  refreshToken: refreshTokenSchema,
  deviceId: deviceIdSchema,
});

export const logoutRequestSchema = z.object({
  deviceId: deviceIdSchema,
});

export const resendVerificationRequestSchema = z.object({
  email: emailSchema,
});

export const verifyEmailRequestSchema = z.object({
  email: emailSchema,
  code: verificationCodeSchema,
});

export const verifyPhoneRequestSchema = z.object({
  phoneNumber: phoneNumberSchema,
  code: verificationCodeSchema,
});

export const resendPhoneOtpRequestSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: strongPasswordSchema,
  })
  .refine(
    (data) => data.currentPassword !== data.newPassword,
    { message: 'Mật khẩu mới phải khác mật khẩu hiện tại', path: ['newPassword'] },
  );

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: verificationCodeSchema,
  newPassword: strongPasswordSchema,
});

export const meResponseSchema = z.object({
  id: z.string().uuid('ID người dùng phải là UUID hợp lệ'),
  email: emailSchema,
  role: userRoleSchema,
  emailVerified: z.boolean(),
  fullName: fullNameSchema,
  dateOfBirth: dateOfBirthSchema,
  address: addressSchema,
  phoneNumber: phoneNumberSchema,
  phoneVerified: z.boolean(),
});

export const authTokensResponseSchema = z.object({
  accessToken: z.string({ required_error: 'Access token là bắt buộc' }),
  refreshToken: z.string({ required_error: 'Refresh token là bắt buộc' }),
  tokenType: z.string().default('Bearer'),
  expiresIn: positiveIntegerSchema,
  refreshTokenExpiresIn: positiveIntegerSchema,
  phoneVerificationRequired: z.boolean().optional(),
});

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
