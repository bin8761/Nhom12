import type { Request, Response, NextFunction } from 'express';
import {
  listActiveProvinces,
  searchLocationSuggestions,
} from '../services/location.service';
import { ValidationError } from '../utils/errors';

const MAX_LIMIT = 50;

function parseLimit(raw: unknown, fallback: number, max = MAX_LIMIT): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export async function listProvincesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const provinces = await listActiveProvinces();
    res.json({
      data: provinces.map((province) => ({
        code: province.code,
        name: province.name,
        slug: province.slug,
        priority: province.priority,
      })),
    });
  } catch (error) {
    next(error);
  }
}



export async function suggestLocationsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = String(req.query.q ?? '').trim();
    if (query.length < 2) {
      throw new ValidationError('Query must be at least 2 characters long');
    }

    const limit = parseLimit(req.query.limit, 10, 20);

    const suggestions = await searchLocationSuggestions(query, { limit });

    res.json({
      data: suggestions,
      meta: {
        query,
        type: 'province',
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
}
