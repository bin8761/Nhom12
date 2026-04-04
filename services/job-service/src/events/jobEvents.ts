import { getNatsConnectionOrNull } from '../infra/nats/natsClient';

interface PublishOptions {
  subject: string;
  payload: unknown;
}

function publishEvent({ subject, payload }: PublishOptions): void {
  const connection = getNatsConnectionOrNull();
  if (!connection) {
    console.warn(`[Job Events] NATS connection not initialised. Skipping ${subject} publish.`);
    return;
  }

  const buffer = Buffer.from(JSON.stringify(payload));
  connection.publish(subject, buffer);
}

export interface JobCreatedEvent {
  jobId: string;
  employerId: string;
  title: string;
  slug: string;
  createdAt: string;
}

export function publishJobCreatedEvent(event: JobCreatedEvent): void {
  publishEvent({
    subject: 'job.created.v1',
    payload: event,
  });
}

export interface JobApprovedEvent {
  jobId: string;
  employerId: string;
  title: string;
  slug: string;
  approvedBy: string;
  approvedAt: string;
}

export function publishJobApprovedEvent(event: JobApprovedEvent): void {
  publishEvent({
    subject: 'job.approved.v1',
    payload: event,
  });
}

export interface JobRejectedEvent {
  jobId: string;
  employerId: string;
  title: string;
  slug: string;
  rejectedBy: string;
  rejectedAt: string;
  reason?: string;
}

export function publishJobRejectedEvent(event: JobRejectedEvent): void {
  publishEvent({
    subject: 'job.rejected.v1',
    payload: event,
  });
}

export interface CvParsedEvent {
  cvId: string;
  candidateId: string;
  parsedFields: Record<string, unknown>;
  parsedAt: string;
}

export function publishCvParsedEvent(event: CvParsedEvent): void {
  publishEvent({
    subject: 'cv.parsed.v1',
    payload: event,
  });
}

export interface CvDecisionEvent {
  applicationId: string;
  jobId: string;
  candidateId: string;
  status: string;
  note?: string;
  decidedAt: string;
}

export function publishCvDecisionEvent(event: CvDecisionEvent): void {
  publishEvent({
    subject: 'cv.decision.v1',
    payload: event,
  });
}

