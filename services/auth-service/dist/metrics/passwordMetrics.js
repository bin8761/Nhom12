"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPasswordChange = recordPasswordChange;
exports.recordPasswordResetRequest = recordPasswordResetRequest;
exports.recordPasswordResetResult = recordPasswordResetResult;
const prom_client_1 = require("prom-client");
const passwordChangeCounter = prom_client_1.register.getSingleMetric('password_change_total') ??
    new prom_client_1.Counter({
        name: 'password_change_total',
        help: 'Total password change attempts',
        labelNames: ['result'],
    });
if (!prom_client_1.register.getSingleMetric('password_change_total')) {
    prom_client_1.register.registerMetric(passwordChangeCounter);
}
const passwordResetRequestCounter = prom_client_1.register.getSingleMetric('password_reset_request_total') ??
    new prom_client_1.Counter({
        name: 'password_reset_request_total',
        help: 'Total password reset requests',
        labelNames: ['result'],
    });
if (!prom_client_1.register.getSingleMetric('password_reset_request_total')) {
    prom_client_1.register.registerMetric(passwordResetRequestCounter);
}
const passwordResetResultCounter = prom_client_1.register.getSingleMetric('password_reset_total') ??
    new prom_client_1.Counter({
        name: 'password_reset_total',
        help: 'Total password reset attempts processed',
        labelNames: ['result'],
    });
if (!prom_client_1.register.getSingleMetric('password_reset_total')) {
    prom_client_1.register.registerMetric(passwordResetResultCounter);
}
function recordPasswordChange(result) {
    try {
        passwordChangeCounter.labels(result).inc();
    }
    catch {
        // swallow metrics errors to avoid impacting main flow
    }
}
function recordPasswordResetRequest(result) {
    try {
        passwordResetRequestCounter.labels(result).inc();
    }
    catch {
        // swallow metrics errors to avoid impacting main flow
    }
}
function recordPasswordResetResult(result) {
    try {
        passwordResetResultCounter.labels(result).inc();
    }
    catch {
        // swallow metrics errors to avoid impacting main flow
    }
}
//# sourceMappingURL=passwordMetrics.js.map