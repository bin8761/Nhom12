"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPhoneOtpSent = recordPhoneOtpSent;
exports.recordPhoneOtpVerified = recordPhoneOtpVerified;
exports.recordPhoneOtpFailed = recordPhoneOtpFailed;
exports.recordPhoneOtpWorkerFailed = recordPhoneOtpWorkerFailed;
const prom_client_1 = require("prom-client");
const phoneOtpSentCounter = prom_client_1.register.getSingleMetric('phone_verification_sent_total') ??
    new prom_client_1.Counter({
        name: 'phone_verification_sent_total',
        help: 'Total number of phone verification OTPs sent',
        labelNames: ['source'],
    });
if (!prom_client_1.register.getSingleMetric('phone_verification_sent_total')) {
    prom_client_1.register.registerMetric(phoneOtpSentCounter);
}
const phoneOtpVerifiedCounter = prom_client_1.register.getSingleMetric('phone_verification_verified_total') ??
    new prom_client_1.Counter({
        name: 'phone_verification_verified_total',
        help: 'Total number of phone verification OTPs successfully verified',
        labelNames: ['source'],
    });
if (!prom_client_1.register.getSingleMetric('phone_verification_verified_total')) {
    prom_client_1.register.registerMetric(phoneOtpVerifiedCounter);
}
const phoneOtpFailedCounter = prom_client_1.register.getSingleMetric('phone_verification_failed_total') ??
    new prom_client_1.Counter({
        name: 'phone_verification_failed_total',
        help: 'Total number of failed phone verification attempts',
        labelNames: ['reason'],
    });
if (!prom_client_1.register.getSingleMetric('phone_verification_failed_total')) {
    prom_client_1.register.registerMetric(phoneOtpFailedCounter);
}
const phoneOtpWorkerFailureCounter = prom_client_1.register.getSingleMetric('phone_verification_worker_failed_total') ??
    new prom_client_1.Counter({
        name: 'phone_verification_worker_failed_total',
        help: 'Total number of phone verification worker failures',
        labelNames: ['reason'],
    });
if (!prom_client_1.register.getSingleMetric('phone_verification_worker_failed_total')) {
    prom_client_1.register.registerMetric(phoneOtpWorkerFailureCounter);
}
function getSourceLabel(source) {
    if (source === 'register' || source === 'resend') {
        return source;
    }
    return 'other';
}
function recordPhoneOtpSent(source) {
    try {
        phoneOtpSentCounter.labels(getSourceLabel(source)).inc();
    }
    catch {
        // swallow metrics errors
    }
}
function recordPhoneOtpVerified(source) {
    try {
        phoneOtpVerifiedCounter.labels(getSourceLabel(source)).inc();
    }
    catch {
        // swallow metrics errors
    }
}
function recordPhoneOtpFailed(reason) {
    try {
        phoneOtpFailedCounter.labels(reason).inc();
    }
    catch {
        // swallow metrics errors
    }
}
function recordPhoneOtpWorkerFailed(reason) {
    try {
        phoneOtpWorkerFailureCounter.labels(reason).inc();
    }
    catch {
        // swallow metrics errors
    }
}
//# sourceMappingURL=phoneVerificationMetrics.js.map