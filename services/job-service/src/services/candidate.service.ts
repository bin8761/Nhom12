import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { NotFoundError } from '../utils/errors';
import { ensureLocationSnapshot } from './locationValidation.service';
import { invalidateCandidateRecommendationCache } from './recommendation.service';

const prisma = getPrismaClient();

export interface CandidateLocationPreference {
  candidateId: string;
  preferredProvinceCode: string;
  preferredAddressLine: string;
  preferredLocationNote: string | null;
}

export async function updateCandidateLocationPreference(params: {
  candidateId: string;
  provinceCode?: string;
  addressLine: string;
  note?: string;
}): Promise<CandidateLocationPreference> {
  // If provinceCode not provided, try to parse from addressLine
  let provinceCode = params.provinceCode;

  if (!provinceCode) {
    const { tryMatchLocationFromText } = await import('./recommendation.service');
    const parsed = await tryMatchLocationFromText(params.addressLine);
    if (parsed) {
      provinceCode = parsed.provinceCode;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    if (provinceCode) {
      await ensureLocationSnapshot(tx, provinceCode);
    }

    try {
      const updated = await tx.candidate.update({
        where: { id: params.candidateId },
        data: {
          preferredProvinceCode: provinceCode || null,
          preferredAddressLine: params.addressLine,
          preferredLocationNote: params.note ?? null,
        },
        select: {
          id: true,
          preferredProvinceCode: true,
          preferredAddressLine: true,
          preferredLocationNote: true,
        },
      });

      return {
        candidateId: updated.id,
        preferredProvinceCode: updated.preferredProvinceCode ?? provinceCode ?? '',
        preferredAddressLine: updated.preferredAddressLine ?? params.addressLine,
        preferredLocationNote: updated.preferredLocationNote ?? params.note ?? null,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundError('Candidate not found');
      }

      throw error;
    }
  });

  await invalidateCandidateRecommendationCache(params.candidateId);

  return result;
}
