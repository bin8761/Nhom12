import { z } from 'zod';

const emailSchema = z
  .string({ required_error: 'Email is required' })
  .email('Email must be a valid email address');

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters');

const deviceIdSchema = z
  .string({ required_error: 'Device ID is required' })
  .min(1, 'Device ID is required');

const positiveIntegerSchema = z
  .number()
  .int('Value must be an integer')
  .positive('Value must be positive');

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  deviceId: deviceIdSchema,
});

export const authTokensResponseSchema = z.object({
  accessToken: z.string({ required_error: 'Access token is required' }),
  refreshToken: z.string({ required_error: 'Refresh token is required' }),
  tokenType: z.string().default('Bearer'),
  expiresIn: positiveIntegerSchema,
  refreshTokenExpiresIn: positiveIntegerSchema,
});

export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
export type AuthTokensResponse = z.infer<typeof authTokensResponseSchema>;
