import { appendJobLog } from '../audit-log.service';

jest.mock('../../infra/prisma/prismaClient', () => {
  const jobApprovalLogCreateMock = jest.fn();
  return {
    __esModule: true,
    getPrismaClient: jest.fn(() => ({
      jobApprovalLog: {
        create: (...args: unknown[]) => jobApprovalLogCreateMock(...args),
      },
    })),
    __mocks: {
      jobApprovalLogCreateMock,
    },
  };
});

const prismaModule = jest.requireMock('../../infra/prisma/prismaClient') as {
  __mocks: { jobApprovalLogCreateMock: jest.Mock };
};
const prismaJobApprovalLogCreateMock = prismaModule.__mocks.jobApprovalLogCreateMock;

describe('appendJobLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaJobApprovalLogCreateMock.mockClear();
  });

  it('writes using default Prisma client when no transaction is provided', async () => {
    await appendJobLog({ jobId: 'job', action: 'SUBMITTED' as any });

    expect(prismaJobApprovalLogCreateMock).toHaveBeenCalledWith({
      data: {
        jobId: 'job',
        action: 'SUBMITTED',
        performedBy: null,
        note: null,
      },
    });
  });

  it('prefers provided transaction client', async () => {
    const txCreateMock = jest.fn();
    const tx = {
      jobApprovalLog: {
        create: txCreateMock,
      },
    } as any;

    await appendJobLog({
      jobId: 'job',
      action: 'SUBMITTED' as any,
      performedBy: 'admin',
      note: 'Reviewed',
      tx,
    });

    expect(txCreateMock).toHaveBeenCalledWith({
      data: {
        jobId: 'job',
        action: 'SUBMITTED',
        performedBy: 'admin',
        note: 'Reviewed',
      },
    });
    expect(prismaJobApprovalLogCreateMock).not.toHaveBeenCalled();
  });
});
