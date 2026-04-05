"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordProfileFetch = recordProfileFetch;
exports.recordProfileUpdate = recordProfileUpdate;
const prom_client_1 = require("prom-client");
const profileFetchCounter = prom_client_1.register.getSingleMetric('profile_fetch_total') ??
    new prom_client_1.Counter({
        name: 'profile_fetch_total',
        help: 'Total number of profile fetch operations',
        labelNames: ['role', 'status'],
    });
if (!prom_client_1.register.getSingleMetric('profile_fetch_total')) {
    prom_client_1.register.registerMetric(profileFetchCounter);
}
const profileUpdateCounter = prom_client_1.register.getSingleMetric('profile_update_total') ??
    new prom_client_1.Counter({
        name: 'profile_update_total',
        help: 'Total number of profile update attempts',
        labelNames: ['role', 'status'],
    });
if (!prom_client_1.register.getSingleMetric('profile_update_total')) {
    prom_client_1.register.registerMetric(profileUpdateCounter);
}
const profileUpdateDurationHistogram = prom_client_1.register.getSingleMetric('profile_update_duration_seconds') ??
    new prom_client_1.Histogram({
        name: 'profile_update_duration_seconds',
        help: 'Profile update duration in seconds',
        labelNames: ['role', 'status'],
        buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    });
if (!prom_client_1.register.getSingleMetric('profile_update_duration_seconds')) {
    prom_client_1.register.registerMetric(profileUpdateDurationHistogram);
}
function recordProfileFetch(role, status) {
    try {
        profileFetchCounter.labels(role, status).inc();
    }
    catch {
        // Swallow metrics errors
    }
}
function recordProfileUpdate(role, status, durationSeconds) {
    try {
        profileUpdateCounter.labels(role, status).inc();
        profileUpdateDurationHistogram.labels(role, status).observe(durationSeconds);
    }
    catch {
        // Swallow metrics errors
    }
}
//# sourceMappingURL=profileMetrics.js.map