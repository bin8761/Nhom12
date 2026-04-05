"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../validation");
describe('validation utils', () => {
    describe('isAdult', () => {
        it('returns true for date at least 18 years ago', () => {
            expect((0, validation_1.isAdult)('01/01/1990')).toBe(true);
        });
        it('returns false for invalid date format', () => {
            expect((0, validation_1.isAdult)('31/13/2020')).toBe(false);
        });
        it('returns false for underage date', () => {
            expect((0, validation_1.isAdult)('01/01/2010')).toBe(false);
        });
    });
    describe('hashOtp', () => {
        it('produces deterministic hash', () => {
            const value = '123456';
            expect((0, validation_1.hashOtp)(value)).toEqual((0, validation_1.hashOtp)(value));
        });
    });
    describe('isStrongPassword', () => {
        it('accepts password with letters and numbers length >= 10', () => {
            expect((0, validation_1.isStrongPassword)('StrongPass1')).toBe(true);
        });
        it('rejects passwords shorter than 10 characters', () => {
            expect((0, validation_1.isStrongPassword)('Short1')).toBe(false);
        });
        it('rejects passwords without numbers', () => {
            expect((0, validation_1.isStrongPassword)('OnlyLetters')).toBe(false);
        });
        it('rejects passwords without letters', () => {
            expect((0, validation_1.isStrongPassword)('1234567890')).toBe(false);
        });
    });
});
//# sourceMappingURL=validation.test.js.map