import type { Request } from 'express';
import { randomUUID } from 'crypto';

export function resolveRequestId(req?: Request): string {
  if (!req) {
    return randomUUID();
  }

  const header =
    (req.get('x-request-id') ?? req.get('X-Request-Id'))?.trim() ?? '';

  if (header.length > 0) {
    return header;
  }

  return randomUUID();
}
