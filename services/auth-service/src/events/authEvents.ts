import { getNatsConnectionOrNull } from '../infra/nats/natsClient';

export interface AuthUserRegisteredEvent {
  id: string;
  email: string;
  role: string;
  emittedAt: string;
}

export interface EmployerApprovalEvent {
  userId: string;
  email: string;
  role: string;
  approvalStatus: 'approved' | 'rejected' | 'pending';
  approvedBy: string | null;
  approvedAt: string;
  rejectionReason?: string;
}

export interface UserProfileUpdatedEvent {
  userId: string;
  role: 'CANDIDATE' | 'EMPLOYER';
  changedFields: string[];
  updatedAt: string | null;
}

export async function publishAuthUserRegisteredEvent(event: AuthUserRegisteredEvent): Promise<void> {
  const connection = getNatsConnectionOrNull();
  if (!connection) {
    console.warn('[Auth Events] NATS connection not initialised. Skipping auth.user.registered.v1 publish.');
    return;
  }

  const subject = 'auth.user.registered.v1';
  const payload = Buffer.from(JSON.stringify(event));
  connection.publish(subject, payload);
}

export async function publishEmployerApprovalEvent(event: EmployerApprovalEvent): Promise<void> {
  const connection = getNatsConnectionOrNull();
  if (!connection) {
    console.warn('[Auth Events] NATS connection not initialised. Skipping employer.approval.status.v1 publish.');
    return;
  }

  const subject = 'employer.approval.status.v1';
  const payload = Buffer.from(JSON.stringify(event));
  connection.publish(subject, payload);
}

export async function publishUserProfileUpdatedEvent(event: UserProfileUpdatedEvent): Promise<void> {
  const connection = getNatsConnectionOrNull();
  if (!connection) {
    console.warn('[Auth Events] NATS connection not initialised. Skipping user.profile.updated.v1 publish.');
    return;
  }

  const subject = 'user.profile.updated.v1';
  const payload = Buffer.from(JSON.stringify(event));
  connection.publish(subject, payload);
}
