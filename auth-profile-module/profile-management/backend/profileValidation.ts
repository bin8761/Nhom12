export const PHONE_NUMBER_REGEX = /^(\+?84|0)(\d{9,10})$/;

export const PROFILE_TAG_MAX_ITEMS = 20;
export const PROFILE_TAG_MAX_LENGTH = 40;

/**
 * Trims surrounding whitespace from user-provided text.
 */
export function sanitizeText(value: string): string {
  return value.trim();
}

export function isValidVietnamPhoneNumber(value: string): boolean {
  return PHONE_NUMBER_REGEX.test(value.trim());
}

export function sanitizeTagList(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawItem of items) {
    const item = rawItem.trim();
    if (!item) {
      continue;
    }
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
}

export function isTagListTooLong(items: readonly string[], maxItems = PROFILE_TAG_MAX_ITEMS): boolean {
  return items.length > maxItems;
}

export function isValidRelativePdfPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    return false;
  }

  if (trimmed.includes('..') || trimmed.includes('\\')) {
    return false;
  }

  return trimmed.toLowerCase().endsWith('.pdf');
}
