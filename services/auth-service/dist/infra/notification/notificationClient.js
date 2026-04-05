"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
const appConfig_1 = require("../../config/appConfig");
const TEMPLATE_KEY = 'auth.email.verification';
const SERVICE_HEADER_VALUE = 'auth-service';
function getFetchImplementation() {
    const candidate = globalThis.fetch;
    if (!candidate) {
        throw new Error('Fetch API is not available in the current runtime. Provide a compatible polyfill or upgrade Node.js.');
    }
    return candidate;
}
function buildEndpoint(baseUrl) {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${normalizedBase}internal/emails/send`;
}
async function sendVerificationEmail(payload) {
    const config = (0, appConfig_1.loadAppConfig)();
    const fetchImpl = getFetchImplementation();
    const endpoint = buildEndpoint(config.notificationService.baseUrl);
    const locale = payload.locale ?? config.notificationService.defaultLocale;
    const headers = {
        'content-type': 'application/json',
        'x-service-name': SERVICE_HEADER_VALUE,
    };
    if (payload.requestId) {
        headers['x-request-id'] = payload.requestId;
    }
    const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            templateKey: TEMPLATE_KEY,
            to: payload.email,
            locale,
            variables: {
                verificationCode: payload.verificationCode,
                userId: payload.userId,
            },
        }),
    });
    if (response?.ok) {
        return;
    }
    const status = typeof response?.status === 'number' ? response.status : 'unknown';
    let responseBody;
    try {
        if (typeof response?.text === 'function') {
            responseBody = await response.text();
        }
    }
    catch (error) {
        responseBody = undefined;
    }
    const details = responseBody ? ` Response body: ${responseBody}` : '';
    throw new Error(`Notification service responded with status ${status}.${details}`);
}
//# sourceMappingURL=notificationClient.js.map