import { randomBytes } from 'crypto';

const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export interface GenerateSlugOptions {
  base: string;
  suffixLength?: number;
}

export const generateSlugBase = ({ base }: GenerateSlugOptions): string => {
  const normalized = slugify(base);
  return normalized.length > 180 ? normalized.slice(0, 180) : normalized;
};

export const appendSlugDiscriminator = (
  current: string,
  suffixLength = 4,
): string => {
  const suffix = randomBytes(Math.ceil(suffixLength / 2))
    .toString('hex')
    .slice(0, suffixLength);
  const trimmed = current.length > 180 ? current.slice(0, 180) : current;
  return `${trimmed}-${suffix}`;
};
