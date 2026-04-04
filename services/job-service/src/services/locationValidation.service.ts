import type { Prisma } from '@prisma/client';
import { ValidationError } from '../utils/errors';

export interface LocationSnapshot {
  provinceCode: string;
  provinceName: string;
}

export async function ensureLocationSnapshot(
  tx: Prisma.TransactionClient,
  provinceCode: string,
): Promise<LocationSnapshot> {
  const province = await tx.province.findUnique({
    where: { code: provinceCode },
  });

  if (!province || !province.active) {
    throw new ValidationError('Tỉnh/Thành phố không hợp lệ hoặc không hoạt động');
  }

  return {
    provinceCode: province.code,
    provinceName: province.name,
  };
}

