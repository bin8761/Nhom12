import {
  registerRequestSchema,
  verifyPhoneRequestSchema,
  resendPhoneOtpRequestSchema,
} from '../authSchemas';

describe('authSchemas', () => {
  describe('registerRequestSchema', () => {
    const basePayload = {
      email: 'candidate@example.com',
      password: 'Password123!',
      role: 'candidate',
      deviceId: 'device-123',
      fullName: 'Nguyen Van A',
      dateOfBirth: '01/01/1990',
      address: '123 Nguyen Trai, District 1, HCMC',
      phoneNumber: '0912345678',
    };

    it('accepts a valid payload', () => {
      const result = registerRequestSchema.safeParse(basePayload);
      expect(result.success).toBe(true);
    });

    it('rejects when date of birth is under 18 years', () => {
      const result = registerRequestSchema.safeParse({
        ...basePayload,
        dateOfBirth: '01/01/2015',
      });
      expect(result.success).toBe(false);
      expect(result.success ? [] : result.error.issues[0].message).toContain('at least 18 years');
    });

    it('rejects when phone number is not Vietnamese format', () => {
      const result = registerRequestSchema.safeParse({
        ...basePayload,
        phoneNumber: '+15551234567',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Vietnamese');
      }
    });

    it('rejects when required profile fields are missing', () => {
      const { fullName, dateOfBirth, address, phoneNumber, ...rest } = basePayload;
      const result = registerRequestSchema.safeParse(rest);
      expect(result.success).toBe(false);
      if (!result.success) {
        const missingFields = result.error.issues.map((issue) => issue.path.join('.'));
        expect(missingFields).toEqual(
          expect.arrayContaining(['fullName', 'dateOfBirth', 'address', 'phoneNumber']),
        );
      }
    });
  });

  describe('verifyPhoneRequestSchema', () => {
    it('accepts valid payload', () => {
      const result = verifyPhoneRequestSchema.safeParse({
        phoneNumber: '0987654321',
        code: '123456',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid OTP length', () => {
      const result = verifyPhoneRequestSchema.safeParse({
        phoneNumber: '0987654321',
        code: '12',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('6 characters');
      }
    });
  });

  describe('resendPhoneOtpRequestSchema', () => {
    it('accepts valid phone number', () => {
      const result = resendPhoneOtpRequestSchema.safeParse({
        phoneNumber: '0912345678',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid phone number', () => {
      const result = resendPhoneOtpRequestSchema.safeParse({
        phoneNumber: '12345',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Vietnamese');
      }
    });
  });
});
