import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authAccess } from '../authAccess';
import { loadAppConfig } from '../../config/appConfig';

jest.mock('../../config/appConfig', () => ({
  loadAppConfig: jest.fn(() => ({
    jwt: {
      algorithm: 'RS256',
      issuer: 'issuer',
      audience: 'audience',
    },
  })) as jest.Mock,
}));

jest.mock('../../utils/tokenGenerator', () => ({
  resolvePublicKey: jest.fn(() => 'publicKey'),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(() => ({
    sub: 'user-1',
    email: 'user@example.com',
    role: 'EMPLOYER',
    emailVerified: true,
    approvalStatus: 'APPROVED',
    tokenUse: 'access',
  })),
}));

const createMockReqRes = () => {
  const req = {
    get: jest.fn(),
  } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
  const next = jest.fn();
  return { req, res, next };
};

describe('authAccess middleware', () => {
  it('allows valid token', () => {
    const { req, res, next } = createMockReqRes();
    req.get = jest.fn().mockReturnValue('Bearer token');

    authAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).user).toMatchObject({ id: 'user-1', role: 'EMPLOYER' });
  });

  it('rejects missing token', () => {
    const { req, res, next } = createMockReqRes();
    req.get = jest.fn().mockReturnValue(undefined);

    authAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });
});
