"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPhoneVerificationSms = sendPhoneVerificationSms;
const logger_1 = __importDefault(require("../../utils/logger"));
async function sendPhoneVerificationSms(payload) {
    // Stubbed SMS provider: log instead of calling a real gateway.
    if (process.env.NODE_ENV !== 'production') {
        logger_1.default.info({
            event: 'phone_verification_sms_debug',
            userId: payload.userId,
            phoneNumber: payload.phoneNumber,
            code: payload.code,
        });
    }
}
//# sourceMappingURL=smsProvider.js.map