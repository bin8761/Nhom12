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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_process_1 = __importDefault(require("node:process"));
const prismaClient_1 = require("../infra/prisma/prismaClient");
const authService = __importStar(require("../services/auth.service"));
const errors_1 = require("../utils/errors");
function parseArgs(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!token.startsWith('-')) {
            continue;
        }
        const [flag, valueFromAssignment] = token.split('=', 2);
        const resolveValue = () => {
            if (valueFromAssignment !== undefined) {
                return valueFromAssignment;
            }
            const nextIndex = index + 1;
            const candidate = args[nextIndex];
            if (candidate && !candidate.startsWith('-')) {
                index = nextIndex;
                return candidate;
            }
            return undefined;
        };
        switch (flag) {
            case '--user-id':
            case '--userId':
            case '-u':
                options.userId = resolveValue();
                break;
            case '--device-id':
            case '--deviceId':
            case '-d':
                options.deviceId = resolveValue();
                break;
            case '--request-id':
            case '--requestId':
            case '-r':
                options.requestId = resolveValue();
                break;
            default:
                break;
        }
    }
    return options;
}
function printUsage() {
    console.info('Usage: npm run admin:revoke -- --user-id <uuid> --device-id <device> [--request-id <id>]');
    console.info('Example: npm run admin:revoke -- --user-id 5cec0db2-1bd0-4cc3-9c29-3f77a7b3f0b8 --device-id ios-12345');
}
async function run() {
    const { userId, deviceId, requestId } = parseArgs(node_process_1.default.argv.slice(2));
    if (!userId || !deviceId) {
        printUsage();
        node_process_1.default.exitCode = 1;
        return;
    }
    const prisma = (0, prismaClient_1.getPrismaClient)();
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            console.error('[Admin CLI] User not found', { userId });
            node_process_1.default.exitCode = 1;
            return;
        }
        await authService.logout({ deviceId }, {
            userId,
            userEmail: user.email,
            userAgent: 'admin-cli',
            ipAddress: null,
            requestId: requestId ?? null,
        });
        console.info('[Admin CLI] Refresh token successfully revoked', { userId, deviceId });
    }
    catch (error) {
        if ((0, errors_1.isServiceError)(error)) {
            console.error('[Admin CLI] Failed to revoke refresh token', {
                userId,
                deviceId,
                code: error.code,
                message: error.message,
            });
        }
        else {
            console.error('[Admin CLI] Unexpected error while revoking refresh token', error);
        }
        node_process_1.default.exitCode = 1;
    }
    finally {
        await (0, prismaClient_1.disconnectPrismaClient)();
    }
}
run().catch((error) => {
    console.error('[Admin CLI] Fatal error', error);
    node_process_1.default.exitCode = 1;
});
//# sourceMappingURL=revokeRefreshToken.js.map