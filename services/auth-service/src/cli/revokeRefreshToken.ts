import process from 'node:process';
import { getPrismaClient, disconnectPrismaClient } from '../infra/prisma/prismaClient';
import * as authService from '../services/auth.service';
import { isServiceError } from '../utils/errors';

interface CliOptions {
  userId?: string;
  deviceId?: string;
  requestId?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith('-')) {
      continue;
    }

    const [flag, valueFromAssignment] = token.split('=', 2);

    const resolveValue = (): string | undefined => {
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

function printUsage(): void {
  console.info('Usage: npm run admin:revoke -- --user-id <uuid> --device-id <device> [--request-id <id>]');
  console.info('Example: npm run admin:revoke -- --user-id 5cec0db2-1bd0-4cc3-9c29-3f77a7b3f0b8 --device-id ios-12345');
}

async function run(): Promise<void> {
  const { userId, deviceId, requestId } = parseArgs(process.argv.slice(2));

  if (!userId || !deviceId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const prisma = getPrismaClient();

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      console.error('[Admin CLI] User not found', { userId });
      process.exitCode = 1;
      return;
    }

    await authService.logout(
      { deviceId },
      {
        userId,
        userEmail: user.email,
        userAgent: 'admin-cli',
        ipAddress: null,
        requestId: requestId ?? null,
      },
    );

    console.info('[Admin CLI] Refresh token successfully revoked', { userId, deviceId });
  } catch (error) {
    if (isServiceError(error)) {
      console.error('[Admin CLI] Failed to revoke refresh token', {
        userId,
        deviceId,
        code: error.code,
        message: error.message,
      });
    } else {
      console.error('[Admin CLI] Unexpected error while revoking refresh token', error);
    }
    process.exitCode = 1;
  } finally {
    await disconnectPrismaClient();
  }
}

run().catch((error) => {
  console.error('[Admin CLI] Fatal error', error);
  process.exitCode = 1;
});
