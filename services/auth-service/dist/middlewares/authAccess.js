"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authAccess = authAccess;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const appConfig_1 = require("../config/appConfig");
const tokenGenerator_1 = require("../utils/tokenGenerator");
const logger_1 = __importDefault(require("../utils/logger"));
function authAccess(req, res, next) {
    try {
        const authHeader = req.get('authorization') || req.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger_1.default.warn({
                event: 'auth_access_failed',
                reason: 'missing_bearer_token',
                path: req.path,
                method: req.method,
            });
            res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
            return;
        }
        const token = authHeader.slice('Bearer '.length).trim();
        const config = (0, appConfig_1.loadAppConfig)();
        const publicKey = (0, tokenGenerator_1.resolvePublicKey)();
        if (!publicKey) {
            logger_1.default.warn({
                event: 'auth_access_failed',
                reason: 'public_key_unavailable',
                path: req.path,
                method: req.method,
            });
            res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Token verification key unavailable' });
            return;
        }
        const payload = jsonwebtoken_1.default.verify(token, publicKey, {
            algorithms: [config.jwt.algorithm],
            issuer: config.jwt.issuer,
            audience: config.jwt.audience,
        });
        if (payload.tokenUse !== 'access') {
            logger_1.default.warn({
                event: 'auth_access_failed',
                reason: 'invalid_token_use',
                path: req.path,
                method: req.method,
            });
            res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Invalid token use' });
            return;
        }
        // attach minimal user context for controllers
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            emailVerified: payload.emailVerified,
        };
        logger_1.default.info({
            event: 'auth_access_granted',
            path: req.path,
            method: req.method,
            userId: payload.sub,
            role: payload.role,
        });
        next();
    }
    catch (error) {
        logger_1.default.warn({
            event: 'auth_access_failed',
            reason: 'invalid_or_expired_token',
            path: req.path,
            method: req.method,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Invalid or expired access token' });
    }
}
//# sourceMappingURL=authAccess.js.map