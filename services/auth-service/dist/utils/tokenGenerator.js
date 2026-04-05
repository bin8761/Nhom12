"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePublicKey = resolvePublicKey;
exports.generateAuthTokens = generateAuthTokens;
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const appConfig_1 = require("../config/appConfig");
let fallbackKeyPair = null;
let fallbackWarningLogged = false;
function ensureFallbackKeyPair() {
    if (fallbackKeyPair) {
        return fallbackKeyPair;
    }
    const { privateKey, publicKey } = (0, crypto_1.generateKeyPairSync)('rsa', { modulusLength: 2048 });
    fallbackKeyPair = {
        privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
        publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    };
    if (!fallbackWarningLogged) {
        fallbackWarningLogged = true;
        console.warn('[Auth Tokens] JWT keys not provided. Using ephemeral development key pair.');
    }
    return fallbackKeyPair;
}
function resolvePrivateKey() {
    const config = (0, appConfig_1.loadAppConfig)();
    if (config.jwt.privateKey) {
        return config.jwt.privateKey;
    }
    return ensureFallbackKeyPair().privateKey;
}
function resolvePublicKey() {
    const config = (0, appConfig_1.loadAppConfig)();
    if (config.jwt.publicKey) {
        return config.jwt.publicKey;
    }
    const fallback = fallbackKeyPair ?? ensureFallbackKeyPair();
    return fallback.publicKey;
}
function generateAuthTokens(params) {
    const config = (0, appConfig_1.loadAppConfig)();
    const privateKey = resolvePrivateKey();
    const accessTokenExpiresIn = config.authTokens.accessTokenTtlSeconds;
    const refreshTokenExpiresIn = config.authTokens.refreshTokenTtlDays * 24 * 60 * 60;
    const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenExpiresIn * 1000);
    const refreshTokenJti = (0, crypto_1.randomUUID)();
    const accessPayload = {
        sub: params.userId,
        email: params.email,
        role: params.role,
        emailVerified: params.emailVerified,
        deviceId: params.deviceId,
        tokenUse: 'access',
    };
    if (params.approvalStatus) {
        accessPayload.approvalStatus = params.approvalStatus;
    }
    const accessToken = jsonwebtoken_1.default.sign(accessPayload, privateKey, {
        algorithm: config.jwt.algorithm,
        expiresIn: accessTokenExpiresIn,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
    });
    const refreshPayload = {
        sub: params.userId,
        email: params.email,
        role: params.role,
        deviceId: params.deviceId,
        tokenUse: 'refresh',
        jti: refreshTokenJti,
    };
    if (params.approvalStatus) {
        refreshPayload.approvalStatus = params.approvalStatus;
    }
    const refreshToken = jsonwebtoken_1.default.sign(refreshPayload, privateKey, {
        algorithm: config.jwt.algorithm,
        expiresIn: refreshTokenExpiresIn,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
    });
    return {
        accessToken,
        refreshToken,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
        refreshTokenExpiresAt,
        refreshTokenJti,
    };
}
//# sourceMappingURL=tokenGenerator.js.map