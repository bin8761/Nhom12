import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { NotFoundError } from '../utils/errors';
import { normalizeVietnameseText } from '../utils/text';

const prisma = getPrismaClient();

export interface ProvinceSummary {
  code: string;
  name: string;
  slug: string;
  priority: number | null;
  active: boolean;
}

export type LocationSuggestion = {
  type: 'province';
  code: string;
  name: string;
  slug: string;
};

export async function listActiveProvinces(): Promise<ProvinceSummary[]> {
  const provinces = await prisma.province.findMany({
    where: { active: true },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
  });

  return provinces.map((province) => ({
    code: province.code,
    name: province.name,
    slug: province.slug,
    priority: province.priority ?? null,
    active: province.active,
  }));
}



interface SuggestionOptions {
  limit?: number;
}

export async function searchLocationSuggestions(
  rawQuery: string,
  options: SuggestionOptions = {},
): Promise<LocationSuggestion[]> {
  const query = rawQuery.trim();
  if (query.length < 2) {
    return [];
  }

  const limit = Math.min(Math.max(options.limit ?? 10, 1), 20);
  const normalized = normalizeVietnameseText(query);

  const provinceSuggestions = new Map<string, LocationSuggestion>();

  const provinceMatches = await prisma.province.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: query } },
        { slug: { contains: normalized } },
      ],
    },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    take: limit,
  });

  const provinceAliasMatches = normalized
    ? await prisma.provincealias.findMany({
        where: { normalizedAlias: { contains: normalized } },
        include: { province: true },
        take: limit,
      })
    : [];

  const pushProvince = (province: { code: string; name: string; slug: string }) => {
    if (provinceSuggestions.has(province.code)) {
      return;
    }
    provinceSuggestions.set(province.code, {
      type: 'province',
      code: province.code,
      name: province.name,
      slug: province.slug,
    });
  };

  provinceMatches.forEach((province) => pushProvince(province));
  provinceAliasMatches.forEach((alias) => {
    if (alias.province) {
      pushProvince(alias.province);
    }
  });

  const combined: LocationSuggestion[] = [];
  provinceSuggestions.forEach((item) => combined.push(item));

  return combined.slice(0, limit);
}
