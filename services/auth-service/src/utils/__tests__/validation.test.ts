import { hashOtp, isAdult, isStrongPassword } from '../validation';

describe('validation utils', () => {
  describe('isAdult', () => {
    it('returns true for date at least 18 years ago', () => {
      expect(isAdult('01/01/1990')).toBe(true);
    });

    it('returns false for invalid date format', () => {
      expect(isAdult('31/13/2020')).toBe(false);
    });

    it('returns false for underage date', () => {
      expect(isAdult('01/01/2010')).toBe(false);
    });
  });

  describe('hashOtp', () => {
    it('produces deterministic hash', () => {
      const value = '123456';
      expect(hashOtp(value)).toEqual(hashOtp(value));
    });
  });

  describe('isStrongPassword', () => {
    it('accepts password with letters and numbers length >= 10', () => {
      expect(isStrongPassword('StrongPass1')).toBe(true);
    });

    it('rejects passwords shorter than 10 characters', () => {
      expect(isStrongPassword('Short1')).toBe(false);
    });

    it('rejects passwords without numbers', () => {
      expect(isStrongPassword('OnlyLetters')).toBe(false);
    });

    it('rejects passwords without letters', () => {
      expect(isStrongPassword('1234567890')).toBe(false);
    });
  });
});
