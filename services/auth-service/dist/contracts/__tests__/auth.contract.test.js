"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const authSchemas_1 = require("../../schemas/authSchemas");
const specPath = node_path_1.default.join(__dirname, '../../../docs/openapi/auth-service.openapi.yaml');
const openApiSpec = node_fs_1.default.readFileSync(specPath, 'utf8');
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function extractPathBlock(route) {
    const pattern = new RegExp(`^\\s{2}${escapeRegExp(route)}:[\\s\\S]*?(?=^\\s{2}/|^components:|\\Z)`, 'm');
    const match = openApiSpec.match(pattern);
    if (!match) {
        throw new Error(`Failed to locate path block for ${route}`);
    }
    return match[0];
}
function extractComponentBlock(componentName) {
    const pattern = new RegExp(`^\\s{4}${escapeRegExp(componentName)}:[\\s\\S]*?(?=^\\s{4}[A-Za-z]|^\\s{2}[A-Za-z]|\\Z)`, 'm');
    const match = openApiSpec.match(pattern);
    if (!match) {
        throw new Error(`Failed to locate component block for ${componentName}`);
    }
    return match[0];
}
describe('Auth OpenAPI contract - password flows', () => {
    it('documents /auth/change-password with expected response shape', () => {
        const block = extractPathBlock('/auth/change-password');
        expect(block).toContain('$ref: "#/components/schemas/ChangePasswordRequest"');
        expect(block).toContain('example: Password updated');
        expect(block).toMatch(/"401":\s*\n\s*\$ref: "#\/components\/responses\/UnauthorizedError"/);
        expect(block).toMatch(/"409":\s*\n\s*description: Conflict/);
    });
    it('documents /auth/forgot-password including rate limit header', () => {
        const block = extractPathBlock('/auth/forgot-password');
        expect(block).toContain('$ref: "#/components/schemas/ForgotPasswordRequest"');
        expect(block).toContain('Retry-After');
        expect(block).toContain('example: Password reset code sent if the email exists');
        expect(block).toMatch(/"429":\s*\n\s*\$ref: "#\/components\/responses\/RateLimitError"/);
    });
    it('documents /auth/reset-password success payload and errors', () => {
        const block = extractPathBlock('/auth/reset-password');
        expect(block).toContain('$ref: "#/components/schemas/ResetPasswordRequest"');
        expect(block).toContain('example: Password reset successful');
        expect(block).toMatch(/"400":\s*\n\s*\$ref: "#\/components\/responses\/ValidationError"/);
        expect(block).toMatch(/"401":\s*\n\s*\$ref: "#\/components\/responses\/UnauthorizedError"/);
    });
    it('ChangePasswordRequest component matches validation contract', () => {
        const block = extractComponentBlock('ChangePasswordRequest');
        expect(block).toContain('[currentPassword, newPassword]');
        expect(block).toContain('minLength: 10');
        const sample = {
            currentPassword: 'Password123!',
            newPassword: 'NewPassword456!',
        };
        expect(() => authSchemas_1.changePasswordSchema.parse(sample)).not.toThrow();
    });
    it('ForgotPasswordRequest component matches validation contract', () => {
        const block = extractComponentBlock('ForgotPasswordRequest');
        expect(block).toContain('[email]');
        const sample = {
            email: 'user@example.com',
        };
        expect(() => authSchemas_1.forgotPasswordSchema.parse(sample)).not.toThrow();
    });
    it('ResetPasswordRequest component matches validation contract', () => {
        const block = extractComponentBlock('ResetPasswordRequest');
        expect(block).toContain('[email, code, newPassword]');
        expect(block).toContain('minLength: 10');
        const sample = {
            email: 'user@example.com',
            code: '123456',
            newPassword: 'NewPassword456!',
        };
        expect(() => authSchemas_1.resetPasswordSchema.parse(sample)).not.toThrow();
    });
});
//# sourceMappingURL=auth.contract.test.js.map