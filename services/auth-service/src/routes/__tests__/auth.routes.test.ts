import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { InvalidCredentialsError, TokenExpiredError } from '../../utils/errors';

const registerMock = jest.fn();
const changePasswordMock = jest.fn();
const forgotPasswordMock = jest.fn();
const resetPasswordMock = jest.fn();
const verifyPhoneMock = jest.fn();
const resendPhoneVerificationMock = jest.fn();

jest.mock('../../services/auth.service', () => ({
  register: (...args: unknown[]) => registerMock(...args),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  resendVerification: jest.fn(),
  verifyEmail: jest.fn(),
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
  requestPasswordReset: (...args: unknown[]) => forgotPasswordMock(...args),
  resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
  verifyPhone: (...args: unknown[]) => verifyPhoneMock(...args),
  resendPhoneVerification: (...args: unknown[]) => resendPhoneVerificationMock(...args),
  getCurrentUserProfile: jest.fn(),
}));

let currentUser: { id: string; role: string } | null = null;

jest.mock('../../middlewares/authAccess', () => ({
  authAccess: (req: Request, res: Response, next: NextFunction) => {
    if (!currentUser) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }
    (req as any).user = currentUser;
    next();
  },
}));

let shouldRateLimitPhone = false;
let shouldRateLimitPasswordReset = false;

jest.mock('../../middlewares/rateLimit', () => ({
  registerRateLimiter: (req: Request, res: Response, next: NextFunction) => next(),
  loginRateLimiter: (req: Request, res: Response, next: NextFunction) => next(),
  resendVerificationRateLimiter: (req: Request, res: Response, next: NextFunction) => next(),
  passwordResetRateLimiter: (req: Request, res: Response, next: NextFunction) => {
    if (shouldRateLimitPasswordReset) {
      res
        .status(429)
        .json({ code: 'ERR_RATE_LIMIT', message: 'Too many requests. Please try again later.' });
      return;
    }
    next();
  },
  resendPhoneOtpRateLimiter: (req: Request, res: Response, next: NextFunction) => {
    if (shouldRateLimitPhone) {
      res.status(429).json({ code: 'ERR_RATE_LIMIT', message: 'Too many requests. Please try again later.' });
      return;
    }
    next();
  },
}));

import authRouter from '../auth.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  return app;
}

describe('auth.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = null;
    shouldRateLimitPhone = false;
    shouldRateLimitPasswordReset = false;
  });

  describe('POST /auth/register', () => {
    it('returns 400 when required profile fields missing', async () => {
      const app = buildApp();

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'user@example.com',
          password: 'Password123!',
          role: 'candidate',
          deviceId: 'device-abc',
          fullName: 'Nguyen Van A',
          // missing dateOfBirth, address, phoneNumber
        })
        .expect(400);

      expect(response.body).toMatchObject({
        code: 'ERR_VALIDATION',
      });
      expect(registerMock).not.toHaveBeenCalled();
    });

    it('returns 201 with tokens and phoneVerificationRequired', async () => {
      const app = buildApp();
      registerMock.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshTokenExpiresIn: 2592000,
        phoneVerificationRequired: true,
      });

      const payload = {
        email: 'user@example.com',
        password: 'Password123!',
        role: 'candidate',
        deviceId: 'device-abc',
        fullName: 'Nguyen Van A',
        dateOfBirth: '01/01/1990',
        address: '123 Street',
        phoneNumber: '0912345678',
      };

      const response = await request(app).post('/auth/register').send(payload).expect(201);

      expect(registerMock).toHaveBeenCalledWith(payload, expect.any(Object));
      expect(response.body.data).toEqual(
        expect.objectContaining({
          phoneVerificationRequired: true,
          accessToken: 'access',
        }),
      );
    });
  });

  describe('POST /auth/verify-phone', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp();
      await request(app)
        .post('/auth/verify-phone')
        .send({ phoneNumber: '0912345678', code: '123456' })
        .expect(401);
      expect(verifyPhoneMock).not.toHaveBeenCalled();
    });

    it('delegates to service when authenticated', async () => {
      const app = buildApp();
      currentUser = { id: 'user-1', role: 'candidate' };
      verifyPhoneMock.mockResolvedValue(undefined);

      await request(app)
        .post('/auth/verify-phone')
        .set('Authorization', 'Bearer token')
        .set('x-request-id', 'req-123')
        .send({ phoneNumber: '0912345678', code: '123456' })
        .expect(200);

      expect(verifyPhoneMock).toHaveBeenCalledWith(
        { phoneNumber: '0912345678', code: '123456' },
        { userId: 'user-1', requestId: 'req-123' },
      );
    });
  });

  describe('POST /auth/resend-phone-otp', () => {
    it('returns 202 when request accepted', async () => {
      const app = buildApp();
      currentUser = { id: 'user-1', role: 'candidate' };
      resendPhoneVerificationMock.mockResolvedValue(undefined);

      await request(app)
        .post('/auth/resend-phone-otp')
        .set('Authorization', 'Bearer token')
        .send({ phoneNumber: '0912345678' })
        .expect(202);

      expect(resendPhoneVerificationMock).toHaveBeenCalledWith(
        { phoneNumber: '0912345678' },
        { userId: 'user-1', requestId: null },
      );
    });

    it('honours rate limiter returning 429', async () => {
      const app = buildApp();
      currentUser = { id: 'user-1', role: 'candidate' };
      shouldRateLimitPhone = true;

      await request(app)
        .post('/auth/resend-phone-otp')
        .set('Authorization', 'Bearer token')
        .send({ phoneNumber: '0912345678' })
        .expect(429);

      expect(resendPhoneVerificationMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/change-password', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp();

      const response = await request(app)
        .post('/auth/change-password')
        .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' });

      expect(response.status).toBe(401);
      expect(changePasswordMock).not.toHaveBeenCalled();
    });

    it('delegates to service and returns 200 on success', async () => {
      const app = buildApp();
      currentUser = { id: 'user-1', role: 'candidate' };
      changePasswordMock.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer token')
        .set('x-request-id', 'req-123')
        .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' });

      expect(response.status).toBe(200);
      expect(changePasswordMock).toHaveBeenCalledWith(
        { userId: 'user-1', requestId: 'req-123' },
        'Password123!',
        'NewPassword456!',
      );
    });

    it('maps InvalidCredentialsError from service', async () => {
      const app = buildApp();
      currentUser = { id: 'user-1', role: 'candidate' };
      changePasswordMock.mockRejectedValue(new InvalidCredentialsError());

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer token')
        .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'ERR_INVALID_CREDENTIALS',
      });
    });

    it('returns validation error for weak new password', async () => {
      const app = buildApp();
      currentUser = { id: 'user-1', role: 'candidate' };

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer token')
        .send({ currentPassword: 'Password123!', newPassword: 'short1' });

      expect(response.status).toBe(400);
      expect(changePasswordMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('returns validation error when payload missing', async () => {
      const app = buildApp();

      const response = await request(app).post('/auth/forgot-password').send({});

      expect(response.status).toBe(400);
      expect(forgotPasswordMock).not.toHaveBeenCalled();
    });

    it('returns 202 and triggers password reset request', async () => {
      const app = buildApp();
      forgotPasswordMock.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/forgot-password')
        .set('x-request-id', 'req-abc')
        .set('Accept-Language', 'vi-VN')
        .send({ email: 'user@example.com' });

      expect(response.status).toBe(202);
      expect(forgotPasswordMock).toHaveBeenCalledWith(
        { email: 'user@example.com' },
        { requestId: 'req-abc', locale: 'vi-VN' },
      );
    });

    it('returns 429 when rate limit exceeded', async () => {
      const app = buildApp();
      shouldRateLimitPasswordReset = true;

      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'user@example.com' });

      expect(response.status).toBe(429);
      expect(forgotPasswordMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/reset-password', () => {
    it('returns validation error for missing fields', async () => {
      const app = buildApp();

      const response = await request(app).post('/auth/reset-password').send({ email: 'user@example.com' });

      expect(response.status).toBe(400);
      expect(resetPasswordMock).not.toHaveBeenCalled();
    });

    it('returns 200 when reset succeeds', async () => {
      const app = buildApp();
      resetPasswordMock.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/reset-password')
        .set('x-request-id', 'req-reset')
        .send({ email: 'user@example.com', code: '123456', newPassword: 'NewPassword456!' });

      expect(response.status).toBe(200);
      expect(resetPasswordMock).toHaveBeenCalledWith(
        { email: 'user@example.com', code: '123456', newPassword: 'NewPassword456!' },
        { requestId: 'req-reset' },
      );
    });

    it('maps TokenExpiredError to 401 response', async () => {
      const app = buildApp();
      resetPasswordMock.mockRejectedValue(new TokenExpiredError('Reset code expired'));

      const response = await request(app)
        .post('/auth/reset-password')
        .send({ email: 'user@example.com', code: '123456', newPassword: 'NewPassword456!' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'ERR_TOKEN_EXPIRED',
        message: 'Reset code expired',
      });
    });
  });
});
