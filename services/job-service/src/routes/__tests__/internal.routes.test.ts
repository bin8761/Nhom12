import request from 'supertest';
import express from 'express';

const triggerSearchReindex = jest.fn().mockResolvedValue({ details: 'queued', status: 'queued' });

jest.mock('../../services/search-index.service', () => ({
  triggerSearchReindex,
}));

function createApp() {
  process.env.INTERNAL_API_SECRET = 'test-secret';
  const { resetAppConfigCache } = require('../../config/appConfig');
  resetAppConfigCache();
  const internalRouter = require('../internal.routes').default;
  const app = express();
  app.use(express.json());
  app.use('/internal', internalRouter);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.statusCode ?? 500;
    res.status(status).json({ message: err?.message ?? 'Internal error' });
  });
  return app;
}

describe('Internal routes - reindex search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects requests without secret header', async () => {
    const app = createApp();
    await request(app).post('/internal/jobs/reindex-search').expect(401);
    expect(triggerSearchReindex).not.toHaveBeenCalled();
  });

  it('queues reindex when header is valid', async () => {
    const app = createApp();
    await request(app)
      .post('/internal/jobs/reindex-search')
      .set('x-internal-secret', 'test-secret')
      .set('x-internal-actor', 'tests')
      .expect(202)
      .expect((res) => {
        expect(res.body.data.status).toBe('queued');
      });

    expect(triggerSearchReindex).toHaveBeenCalledWith({ actor: 'tests' });
  });
});
