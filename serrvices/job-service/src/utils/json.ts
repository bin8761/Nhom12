export function parseJsonObject<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  // If already an object, check if it's a valid object or stringified object
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Check if it's an array-like object with numeric keys (stringified string)
    const keys = Object.keys(value);
    if (keys.length > 0 && keys.every((k) => !isNaN(Number(k)))) {
      // This is a stringified string, reconstruct it
      const str = keys.sort((a, b) => Number(a) - Number(b)).map((k) => (value as any)[k]).join('');
      // Try to parse the reconstructed string
      try {
        const parsed = JSON.parse(str);
        if (parsed && typeof parsed === 'object') {
          return parsed as T;
        }
      } catch {
        return null;
      }
    }
    // Normal object, return as is
    return value as T;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      // If parsed result is still a string, try parsing again (double-stringified)
      if (typeof parsed === 'string') {
        return parseJsonObject<T>(parsed);
      }
      if (parsed && typeof parsed === 'object') {
        return parsed as T;
      }
    } catch {
      return null;
    }
  }

  return null;
}
