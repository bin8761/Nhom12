import type { Request, Response } from 'express';
import { requireRole } from '../requireRole';

describe('requireRole', () => {
  it('allows matching role', () => {
    const req = { user: { role: 'ADMIN' } } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    requireRole(['ADMIN'])(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('denies when role missing', () => {
    const req = { user: { role: 'EMPLOYER' } } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    requireRole(['ADMIN'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
