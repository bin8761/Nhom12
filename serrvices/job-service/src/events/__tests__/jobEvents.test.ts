import {
  publishJobCreatedEvent,
  publishJobApprovedEvent,
  publishJobRejectedEvent,
} from '../jobEvents';

const publishMock = jest.fn();
let mockConnection: { publish: jest.Mock } | null = { publish: publishMock };

jest.mock('../../infra/nats/natsClient', () => ({
  __esModule: true,
  getNatsConnectionOrNull: jest.fn(() => mockConnection),
}));

describe('job event publishers', () => {
  beforeEach(() => {
    publishMock.mockReset();
    mockConnection = { publish: publishMock };
  });

  it('publishes job.created payload with serialised buffer', () => {
    publishJobCreatedEvent({
      jobId: 'job',
      employerId: 'emp',
      title: 'Title',
      slug: 'title',
      createdAt: '2025-11-11T00:00:00Z',
    });

    expect(publishMock).toHaveBeenCalledWith('job.created.v1', expect.any(Buffer));
    const payload = JSON.parse(publishMock.mock.calls[0][1].toString());
    expect(payload).toMatchObject({ jobId: 'job', slug: 'title' });
  });

  it('publishes job.approved payload', () => {
    publishJobApprovedEvent({
      jobId: 'job',
      employerId: 'emp',
      title: 'Title',
      slug: 'title',
      approvedBy: 'admin',
      approvedAt: '2025-11-12T00:00:00Z',
    });

    expect(publishMock).toHaveBeenCalledWith('job.approved.v1', expect.any(Buffer));
  });

  it('publishes job.rejected payload with reason', () => {
    publishJobRejectedEvent({
      jobId: 'job',
      employerId: 'emp',
      title: 'Title',
      slug: 'title',
      rejectedBy: 'admin',
      rejectedAt: '2025-11-13T00:00:00Z',
      reason: 'Missing info',
    });

    const buffer = publishMock.mock.calls[0][1];
    const payload = JSON.parse(buffer.toString());
    expect(payload.reason).toBe('Missing info');
  });

  it('logs warning when NATS connection is unavailable', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockConnection = null;

    publishJobCreatedEvent({
      jobId: 'job',
      employerId: 'emp',
      title: 'Title',
      slug: 'title',
      createdAt: '2025-11-11T00:00:00Z',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('NATS connection not initialised'),
    );
    expect(publishMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
