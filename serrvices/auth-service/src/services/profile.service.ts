import type { Prisma, CandidateProfile, EmployerProfile, User } from '@prisma/client';
import { ApprovalStatus, UserRole, UserStatus } from '@prisma/client';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import logger from '../utils/logger';
import { EmailNotVerifiedError, ForbiddenError, NotFoundError } from '../utils/errors';
import type { CandidateProfileRequestInput, CandidateProfileResponse, EmployerProfileRequestInput, EmployerProfileResponse } from '../schemas/profile.schema';
import { publishUserProfileUpdatedEvent } from '../events/authEvents';
import { recordProfileFetch } from '../metrics/profileMetrics';

type JsonValue = Prisma.JsonValue;
type EmployerCompanySize = 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';

const prisma = getPrismaClient();

const CANDIDATE_PROFILE_FIELDS: Array<keyof NormalizedCandidateProfile> = [
  'fullName',
  'phoneNumber',
  'location',
];

const EMPLOYER_PROFILE_FIELDS: Array<keyof NormalizedEmployerProfile> = [
  'companyName',
  'companyWebsite',
  'headquartersLocation',
  'contactEmail',
  'contactPhone',
];

const EMPTY_CANDIDATE_PROFILE: CandidateProfileResponse = {
  fullName: null,
  phoneNumber: null,
  dateOfBirth: undefined,
  location: null,
  updatedAt: null,
};

const EMPTY_EMPLOYER_PROFILE: EmployerProfileResponse = {
  companyName: null,
  companyWebsite: null,
  headquartersLocation: null,
  contactEmail: null,
  contactPhone: null,
  updatedAt: null,
};

interface NormalizedCandidateProfile extends Record<string, unknown> {
  fullName: string | null;
  phoneNumber: string | null;
  dateOfBirth: Date | null;
  location: string | null;
  updatedAt: Date | null;
}

interface NormalizedEmployerProfile extends Record<string, unknown> {
  companyName: string | null;
  companyWebsite: string | null;
  headquartersLocation: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  updatedAt: Date | null;
}

function normalizeStringArray(value: JsonValue | undefined | null): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  return [];
}

function normalizeCandidateProfile(profile: CandidateProfile | null): NormalizedCandidateProfile {
  if (!profile) {
    return {
      fullName: null,
      phoneNumber: null,
      dateOfBirth: null,
      location: null,
      updatedAt: null,
    };
  }

  return {
    fullName: profile.fullName ?? null,
    phoneNumber: profile.phoneNumber ?? null,
    dateOfBirth: profile.dateOfBirth ?? null,
    location: profile.location ?? null,
    updatedAt: profile.updatedAt ?? null,
  };
}

function normalizeEmployerProfile(profile: EmployerProfile | null): NormalizedEmployerProfile {
  if (!profile) {
    return {
      companyName: null,
      companyWebsite: null,
      headquartersLocation: null,
      contactEmail: null,
      contactPhone: null,
      updatedAt: null,
    };
  }

  return {
    companyName: profile.companyName ?? null,
    companyWebsite: profile.companyWebsite ?? null,
    headquartersLocation: profile.headquartersLocation ?? null,
    contactEmail: profile.contactEmail ?? null,
    contactPhone: profile.contactPhone ?? null,
    updatedAt: profile.updatedAt ?? null,
  };
}

function toCandidateProfileResponse(profile: NormalizedCandidateProfile): CandidateProfileResponse {
  if (!profile.fullName && !profile.updatedAt) {
    return EMPTY_CANDIDATE_PROFILE;
  }

  return {
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString() : undefined,
    location: profile.location,
    updatedAt: profile.updatedAt ? profile.updatedAt.toISOString() : null,
  };
}

function toEmployerProfileResponse(profile: NormalizedEmployerProfile): EmployerProfileResponse {
  if (!profile.companyName && !profile.updatedAt) {
    return EMPTY_EMPLOYER_PROFILE;
  }

  return {
    companyName: profile.companyName,
    companyWebsite: profile.companyWebsite,
    headquartersLocation: profile.headquartersLocation,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    updatedAt: profile.updatedAt ? profile.updatedAt.toISOString() : null,
  };
}

function ensureCandidateUpdateAllowed(user: User): void {
  if (user.role !== UserRole.CANDIDATE) {
    throw new ForbiddenError('Hồ sơ ứng viên không khả dụng cho người dùng này', 'ERR_PROFILE_ROLE_MISMATCH');
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenError('Hồ sơ ứng viên chỉ có thể cập nhật cho tài khoản đang hoạt động', 'ERR_PROFILE_INACTIVE');
  }

  if (!user.emailVerified) {
    throw new EmailNotVerifiedError();
  }
}

function ensureEmployerUpdateAllowed(user: User): void {
  if (user.role !== UserRole.EMPLOYER) {
    throw new ForbiddenError('Hồ sơ nhà tuyển dụng không khả dụng cho người dùng này', 'ERR_PROFILE_ROLE_MISMATCH');
  }

  if (user.approvalStatus !== ApprovalStatus.APPROVED) {
    throw new ForbiddenError('Hồ sơ nhà tuyển dụng chỉ có thể cập nhật sau khi được phê duyệt', 'ERR_PROFILE_NOT_APPROVED');
  }
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function computeChangedFields<T extends Record<string, unknown>>(
  previous: T,
  current: T,
  fields: Array<keyof T>,
): string[] {
  const changed: string[] = [];

  for (const field of fields) {
    const prevValue = previous[field];
    const currValue = current[field];

    if (Array.isArray(prevValue) && Array.isArray(currValue)) {
      if (!arraysEqual(prevValue as string[], currValue as string[])) {
        changed.push(String(field));
      }
      continue;
    }

    if (prevValue !== currValue) {
      changed.push(String(field));
    }
  }

  return changed;
}

async function loadUserWithProfiles(userId: string): Promise<
  | (User & {
      candidateProfile: CandidateProfile | null;
      employerProfile: EmployerProfile | null;
    })
  | null
> {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      candidateProfile: true,
      employerProfile: true,
    },
  });
}

export type ProfileFetchResult =
  | {
      role: 'CANDIDATE';
      email: string;
      profile: CandidateProfileResponse;
    }
  | {
      role: 'EMPLOYER';
      email: string;
      profile: EmployerProfileResponse;
    };

export async function getProfileByUserId(userId: string): Promise<ProfileFetchResult> {
  let roleForMetrics: 'CANDIDATE' | 'EMPLOYER' = 'CANDIDATE';
  const user = await loadUserWithProfiles(userId);

  if (!user) {
    throw new NotFoundError('Không tìm thấy người dùng');
  }

  if (user.role === UserRole.CANDIDATE) {
    roleForMetrics = 'CANDIDATE';
    const normalized = normalizeCandidateProfile(user.candidateProfile);
    logger.info({
      event: 'candidate_profile_fetched',
      userId: user.id,
      role: user.role,
      hasProfile: Boolean(user.candidateProfile),
    });
    recordProfileFetch(roleForMetrics, user.candidateProfile ? 'hit' : 'miss');
    return {
      role: 'CANDIDATE',
      email: user.email,
      profile: toCandidateProfileResponse(normalized),
    };
  }

  if (user.role === UserRole.EMPLOYER) {
    roleForMetrics = 'EMPLOYER';
    const normalized = normalizeEmployerProfile(user.employerProfile);
    logger.info({
      event: 'employer_profile_fetched',
      userId: user.id,
      role: user.role,
      hasProfile: Boolean(user.employerProfile),
    });
    recordProfileFetch(roleForMetrics, user.employerProfile ? 'hit' : 'miss');
    return {
      role: 'EMPLOYER',
      email: user.email,
      profile: toEmployerProfileResponse(normalized),
    };
  }

  // Admin doesn't have profile
  if (user.role === UserRole.ADMIN) {
    logger.info({
      event: 'admin_profile_access',
      userId: user.id,
      role: user.role,
    });
    throw new ForbiddenError('Quản trị viên không có hồ sơ', 'ERR_ADMIN_NO_PROFILE');
  }

  recordProfileFetch(roleForMetrics, 'error');
  throw new NotFoundError('Hồ sơ không khả dụng cho người dùng này');
}

export interface UpsertCandidateProfileParams {
  userId: string;
  actorId: string;
  payload: CandidateProfileRequestInput;
}

export interface UpsertEmployerProfileParams {
  userId: string;
  actorId: string;
  payload: EmployerProfileRequestInput;
}

export interface UpsertProfileResult {
  profile: CandidateProfileResponse | EmployerProfileResponse;
  changedFields: string[];
  updatedAt: string | null;
}

export async function upsertCandidateProfile({
  userId,
  actorId,
  payload,
}: UpsertCandidateProfileParams): Promise<UpsertProfileResult> {
  const user = await loadUserWithProfiles(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  ensureCandidateUpdateAllowed(user);

  const previous = normalizeCandidateProfile(user.candidateProfile);

  const fullName = (payload.fullName ?? previous.fullName) as string;
  const phoneNumber = (payload.phoneNumber ?? previous.phoneNumber ?? null) as string | null;
  const dateOfBirth = payload.dateOfBirth ? new Date(payload.dateOfBirth) : (previous.dateOfBirth ?? null);
  const location = (payload.location ?? previous.location ?? null) as string | null;

  const data: Prisma.CandidateProfileUncheckedCreateInput = {
    userId: user.id,
    fullName,
    phoneNumber,
    dateOfBirth,
    location,
    updatedBy: actorId,
  };

  const result = await prisma.$transaction(async (trx) => {
    const persisted = await trx.candidateProfile.upsert({
      where: { userId: user.id },
      create: data,
      update: {
        fullName,
        phoneNumber,
        dateOfBirth,
        location,
        updatedBy: actorId,
      },
    });

    return persisted;
  });

  const current = normalizeCandidateProfile(result);
  const changedFields = computeChangedFields<NormalizedCandidateProfile>(previous, current, CANDIDATE_PROFILE_FIELDS);

  logger.info({
    event: 'candidate_profile_updated',
    userId: user.id,
    actorId,
    changedFields,
  });

  const updatedAtIso = current.updatedAt ? current.updatedAt.toISOString() : null;

  if (changedFields.length === 0) {
    logger.info({
      event: 'candidate_profile_update_noop',
      userId: user.id,
      actorId,
    });
  }

  if (changedFields.length > 0) {
    try {
      await publishUserProfileUpdatedEvent({
        userId: user.id,
        role: 'CANDIDATE',
        changedFields,
        updatedAt: updatedAtIso,
      });
    } catch (error) {
      logger.warn({
        event: 'candidate_profile_update_event_failed',
        userId: user.id,
        actorId,
        changedFields,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    profile: toCandidateProfileResponse(current),
    changedFields,
    updatedAt: updatedAtIso,
  };
}

export async function upsertEmployerProfile({
  userId,
  actorId,
  payload,
}: UpsertEmployerProfileParams): Promise<UpsertProfileResult> {
  const user = await loadUserWithProfiles(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  ensureEmployerUpdateAllowed(user);

  const previous = normalizeEmployerProfile(user.employerProfile);
  
  const data: Prisma.EmployerProfileUncheckedCreateInput = {
    userId: user.id,
    companyName: payload.companyName as string,
    companyWebsite: (payload.companyWebsite ?? previous.companyWebsite ?? null) as string | null,
    headquartersLocation: (payload.headquartersLocation ?? previous.headquartersLocation ?? null) as string | null,
    contactEmail: (payload.contactEmail ?? previous.contactEmail ?? user.email) as string,
    contactPhone: (payload.contactPhone ?? previous.contactPhone ?? null) as string | null,
    updatedBy: actorId,
  };

  const result = await prisma.$transaction(async (trx) => {
    const persisted = await trx.employerProfile.upsert({
      where: { userId: user.id },
      create: data,
      update: {
        companyName: data.companyName,
        companyWebsite: data.companyWebsite,
        headquartersLocation: data.headquartersLocation,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        updatedBy: actorId,
      },
    });

    return persisted;
  });

  const current = normalizeEmployerProfile(result);
  const changedFields = computeChangedFields<NormalizedEmployerProfile>(previous, current, EMPLOYER_PROFILE_FIELDS);

  logger.info({
    event: 'employer_profile_updated',
    userId: user.id,
    actorId,
    changedFields,
  });

  const updatedAtIso = current.updatedAt ? current.updatedAt.toISOString() : null;

  if (changedFields.length === 0) {
    logger.info({
      event: 'employer_profile_update_noop',
      userId: user.id,
      actorId,
    });
  }

  if (changedFields.length > 0) {
    try {
      await publishUserProfileUpdatedEvent({
        userId: user.id,
        role: 'EMPLOYER',
        changedFields,
        updatedAt: updatedAtIso,
      });
    } catch (error) {
      logger.warn({
        event: 'employer_profile_update_event_failed',
        userId: user.id,
        actorId,
        changedFields,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    profile: toEmployerProfileResponse(current),
    changedFields,
    updatedAt: updatedAtIso,
  };
}

