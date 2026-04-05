"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyInternalSecret = verifyInternalSecret;
function verifyInternalSecret(req, res, next) {
    const secret = req.headers['x-internal-secret'];
    const expectedSecret = process.env.INTERNAL_API_SECRET || 'dev-internal-secret';
    if (secret !== expectedSecret) {
        res.status(403).json({
            code: 'ERR_FORBIDDEN',
            message: 'Invalid internal secret',
        });
        return;
    }
    next();
}
//# sourceMappingURL=verifyInternalSecret.js.map