import express from 'express';
import request from 'supertest';
import cvRouter from '../cv.routes';

const app = express();
app.use('/api/cv', cvRouter);

describe('CV download access control', () => {
  it('returns 401 when no auth token or signed URL is provided', async () => {
    const response = await request(app).get('/api/cv/download').expect(401);
    expect(response.body.code).toBe('ERR_UNAUTHORIZED');
    expect(response.body.message).toMatch(/access token required/i);
  });
});
