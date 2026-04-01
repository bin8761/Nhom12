import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { normalizeVietnameseText } from '../src/utils/text';

interface AliasSeed {
  alias: string;
}

interface ProvinceSeed {
  code: string;
  name: string;
  slug: string;
  priority?: number;
  aliases?: AliasSeed[];
}

interface LocationSeedFile {
  provinces: ProvinceSeed[];
}

const prisma = new PrismaClient();

async function loadSeedFile(): Promise<LocationSeedFile> {
  const seedPath = path.join(__dirname, 'seed', 'locations.json');
  const raw = await readFile(seedPath, { encoding: 'utf8' });
  const data = JSON.parse(raw) as LocationSeedFile;

  if (!Array.isArray(data.provinces)) {
    throw new Error('Seed file missing provinces array');
  }

  return data;
}

async function upsertProvince(province: ProvinceSeed): Promise<void> {
  const now = new Date();
  await prisma.province.upsert({
    where: { code: province.code },
    create: {
      code: province.code,
      name: province.name,
      slug: province.slug,
      priority: province.priority ?? null,
      updatedAt: now,
    },
    update: {
      name: province.name,
      slug: province.slug,
      priority: province.priority ?? null,
      active: true,
      updatedAt: now,
    },
  });

  if (province.aliases?.length) {
    for (const alias of province.aliases) {
      await prisma.provincealias.upsert({
        where: {
          provinceCode_alias: {
            provinceCode: province.code,
            alias: alias.alias,
          },
        },
        create: {
          id: `${province.code}-${alias.alias}`,
          provinceCode: province.code,
          alias: alias.alias,
          normalizedAlias: normalizeVietnameseText(alias.alias),
        },
        update: {
          normalizedAlias: normalizeVietnameseText(alias.alias),
        },
      });
    }
  }
}

async function seedLocations(): Promise<void> {
  const { provinces } = await loadSeedFile();

  for (const province of provinces) {
    await upsertProvince(province);
  }
}

async function main(): Promise<void> {
  try {
    await seedLocations();
    console.info('[seedLocations] Completed location seeding');
  } catch (error) {
    console.error('[seedLocations] Failed to seed locations', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
