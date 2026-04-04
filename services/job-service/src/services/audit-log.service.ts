import { jobapprovallog_action, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getPrismaClient } from '../infra/prisma/prismaClient';

const prisma = getPrismaClient();

export interface AppendJobLogParams {
  jobId: string;
  action: jobapprovallog_action;
  performedBy?: string | null;
  note?: string | null;
  tx?: Prisma.TransactionClient;
}

export async function appendJobLog(params: AppendJobLogParams): Promise<void> {
  const client = params.tx ?? prisma;
  await client.jobapprovallog.create({
    data: {
      id: randomUUID(),
      jobId: params.jobId,
      action: params.action,
      performedBy: params.performedBy ?? null,
      note: params.note ?? null,
    },
  });
}
