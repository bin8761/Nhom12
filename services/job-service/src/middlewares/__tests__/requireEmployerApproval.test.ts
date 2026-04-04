import type { Request, Response } from 'express';
import { requireEmployerApproval } from '../requireEmployerApproval';

describe('requireEmployerApproval middleware', () => {
  it('allows approved employer', () => {
    const req = { user: { role: 'EMPLOYER', approvalStatus: 'APPROVED' } } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    requireEmployerApproval()(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks non-employer', () => {
    const req = { user: { role: 'CANDIDATE', approvalStatus: 'APPROVED' } } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    requireEmployerApproval()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks pending employer', () => {
    const req = { user: { role: 'EMPLOYER', approvalStatus: 'PENDING' } } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    requireEmployerApproval()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
