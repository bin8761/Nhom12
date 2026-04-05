"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initNatsConnection = initNatsConnection;
exports.getNatsConnection = getNatsConnection;
exports.getNatsConnectionOrNull = getNatsConnectionOrNull;
exports.closeNatsConnection = closeNatsConnection;
let natsConnection = null;
async function initNatsConnection(options) {
    if (natsConnection) {
        return natsConnection;
    }
    const { connect } = await Promise.resolve().then(() => __importStar(require('nats')));
    natsConnection = await connect(options);
    return natsConnection;
}
function getNatsConnection() {
    if (!natsConnection) {
        throw new Error('NATS connection has not been initialised.');
    }
    return natsConnection;
}
function getNatsConnectionOrNull() {
    return natsConnection;
}
async function closeNatsConnection() {
    if (!natsConnection) {
        return;
    }
    await natsConnection.drain();
    natsConnection = null;
}
//# sourceMappingURL=natsClient.js.map