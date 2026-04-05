"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishAuthUserRegisteredEvent = publishAuthUserRegisteredEvent;
exports.publishEmployerApprovalEvent = publishEmployerApprovalEvent;
exports.publishUserProfileUpdatedEvent = publishUserProfileUpdatedEvent;
const natsClient_1 = require("../infra/nats/natsClient");
async function publishAuthUserRegisteredEvent(event) {
    const connection = (0, natsClient_1.getNatsConnectionOrNull)();
    if (!connection) {
        console.warn('[Auth Events] NATS connection not initialised. Skipping auth.user.registered.v1 publish.');
        return;
    }
    const subject = 'auth.user.registered.v1';
    const payload = Buffer.from(JSON.stringify(event));
    connection.publish(subject, payload);
}
async function publishEmployerApprovalEvent(event) {
    const connection = (0, natsClient_1.getNatsConnectionOrNull)();
    if (!connection) {
        console.warn('[Auth Events] NATS connection not initialised. Skipping employer.approval.status.v1 publish.');
        return;
    }
    const subject = 'employer.approval.status.v1';
    const payload = Buffer.from(JSON.stringify(event));
    connection.publish(subject, payload);
}
async function publishUserProfileUpdatedEvent(event) {
    const connection = (0, natsClient_1.getNatsConnectionOrNull)();
    if (!connection) {
        console.warn('[Auth Events] NATS connection not initialised. Skipping user.profile.updated.v1 publish.');
        return;
    }
    const subject = 'user.profile.updated.v1';
    const payload = Buffer.from(JSON.stringify(event));
    connection.publish(subject, payload);
}
//# sourceMappingURL=authEvents.js.map