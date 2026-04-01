"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfileByUserId = getProfileByUserId;
exports.upsertCandidateProfile = upsertCandidateProfile;
exports.upsertEmployerProfile = upsertEmployerProfile;
const client_1 = require("@prisma/client");
const prismaClient_1 = require("../infra/prisma/prismaClient");
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
const authEvents_1 = require("../events/authEvents");
const profileMetrics_1 = require("../metrics/profileMetrics");
const prisma = (0, prismaClient_1.getPrismaClient)();
const CANDIDATE_PROFILE_FIELDS = [
    'fullName',
    'phoneNumber',
    'location',
];
const EMPLOYER_PROFILE_FIELDS = [
    'companyName',
    'companyWebsite',
    'headquartersLocation',
    'contactEmail',
    'contactPhone',
];
const EMPTY_CANDIDATE_PROFILE = {
    fullName: null,
    phoneNumber: null,
    dateOfBirth: undefined,
    location: null,
    updatedAt: null,
};
const EMPTY_EMPLOYER_PROFILE = {
    companyName: null,
    companyWebsite: null,
    headquartersLocation: null,
    contactEmail: null,
    contactPhone: null,
    updatedAt: null,
};
function normalizeStringArray(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string');
    }
    return [];
}
function normalizeCandidateProfile(profile) {
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
function normalizeEmployerProfile(profile) {
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
function toCandidateProfileResponse(profile) {
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
function toEmployerProfileResponse(profile) {
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
function ensureCandidateUpdateAllowed(user) {
    if (user.role !== client_1.UserRole.CANDIDATE) {
        throw new errors_1.ForbiddenError('Hồ sơ ứng viên không khả dụng cho người dùng này', 'ERR_PROFILE_ROLE_MISMATCH');
    }
    if (user.status !== client_1.UserStatus.ACTIVE) {
        throw new errors_1.ForbiddenError('Hồ sơ ứng viên chỉ có thể cập nhật cho tài khoản đang hoạt động', 'ERR_PROFILE_INACTIVE');
    }
    if (!user.emailVerified) {
        throw new errors_1.EmailNotVerifiedError();
    }
}
function ensureEmployerUpdateAllowed(user) {
    if (user.role !== client_1.UserRole.EMPLOYER) {
        throw new errors_1.ForbiddenError('Hồ sơ nhà tuyển dụng không khả dụng cho người dùng này', 'ERR_PROFILE_ROLE_MISMATCH');
    }
    if (user.approvalStatus !== client_1.ApprovalStatus.APPROVED) {
        throw new errors_1.ForbiddenError('Hồ sơ nhà tuyển dụng chỉ có thể cập nhật sau khi được phê duyệt', 'ERR_PROFILE_NOT_APPROVED');
    }
}
function arraysEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    return left.every((value, index) => value === right[index]);
}
function computeChangedFields(previous, current, fields) {
    const changed = [];
    for (const field of fields) {
        const prevValue = previous[field];
        const currValue = current[field];
        if (Array.isArray(prevValue) && Array.isArray(currValue)) {
            if (!arraysEqual(prevValue, currValue)) {
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
async function loadUserWithProfiles(userId) {
    return prisma.user.findUnique({
        where: { id: userId },
        include: {
            candidateProfile: true,
            employerProfile: true,
        },
    });
}
async function getProfileByUserId(userId) {
    let roleForMetrics = 'CANDIDATE';
    const user = await loadUserWithProfiles(userId);
    if (!user) {
        throw new errors_1.NotFoundError('Không tìm thấy người dùng');
    }
    if (user.role === client_1.UserRole.CANDIDATE) {
        roleForMetrics = 'CANDIDATE';
        const normalized = normalizeCandidateProfile(user.candidateProfile);
        logger_1.default.info({
            event: 'candidate_profile_fetched',
            userId: user.id,
            role: user.role,
            hasProfile: Boolean(user.candidateProfile),
        });
        (0, profileMetrics_1.recordProfileFetch)(roleForMetrics, user.candidateProfile ? 'hit' : 'miss');
        return {
            role: 'CANDIDATE',
            profile: toCandidateProfileResponse(normalized),
        };
    }
    if (user.role === client_1.UserRole.EMPLOYER) {
        roleForMetrics = 'EMPLOYER';
        const normalized = normalizeEmployerProfile(user.employerProfile);
        logger_1.default.info({
            event: 'employer_profile_fetched',
            userId: user.id,
            role: user.role,
            hasProfile: Boolean(user.employerProfile),
        });
        (0, profileMetrics_1.recordProfileFetch)(roleForMetrics, user.employerProfile ? 'hit' : 'miss');
        return {
            role: 'EMPLOYER',
            profile: toEmployerProfileResponse(normalized),
        };
    }
    // Admin doesn't have profile
    if (user.role === client_1.UserRole.ADMIN) {
        logger_1.default.info({
            event: 'admin_profile_access',
            userId: user.id,
            role: user.role,
        });
        throw new errors_1.ForbiddenError('Quản trị viên không có hồ sơ', 'ERR_ADMIN_NO_PROFILE');
    }
    (0, profileMetrics_1.recordProfileFetch)(roleForMetrics, 'error');
    throw new errors_1.NotFoundError('Hồ sơ không khả dụng cho người dùng này');
}
async function upsertCandidateProfile({ userId, actorId, payload, }) {
    const user = await loadUserWithProfiles(userId);
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    ensureCandidateUpdateAllowed(user);
    const previous = normalizeCandidateProfile(user.candidateProfile);
    const fullName = (payload.fullName ?? previous.fullName);
    const phoneNumber = (payload.phoneNumber ?? previous.phoneNumber ?? null);
    const dateOfBirth = payload.dateOfBirth ? new Date(payload.dateOfBirth) : (previous.dateOfBirth ?? null);
    const location = (payload.location ?? previous.location ?? null);
    const data = {
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
    const changedFields = computeChangedFields(previous, current, CANDIDATE_PROFILE_FIELDS);
    logger_1.default.info({
        event: 'candidate_profile_updated',
        userId: user.id,
        actorId,
        changedFields,
    });
    const updatedAtIso = current.updatedAt ? current.updatedAt.toISOString() : null;
    if (changedFields.length === 0) {
        logger_1.default.info({
            event: 'candidate_profile_update_noop',
            userId: user.id,
            actorId,
        });
    }
    if (changedFields.length > 0) {
        try {
            await (0, authEvents_1.publishUserProfileUpdatedEvent)({
                userId: user.id,
                role: 'CANDIDATE',
                changedFields,
                updatedAt: updatedAtIso,
            });
        }
        catch (error) {
            logger_1.default.warn({
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
async function upsertEmployerProfile({ userId, actorId, payload, }) {
    const user = await loadUserWithProfiles(userId);
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    ensureEmployerUpdateAllowed(user);
    const previous = normalizeEmployerProfile(user.employerProfile);
    const data = {
        userId: user.id,
        companyName: payload.companyName,
        companyWebsite: (payload.companyWebsite ?? previous.companyWebsite ?? null),
        headquartersLocation: (payload.headquartersLocation ?? previous.headquartersLocation ?? null),
        contactEmail: (payload.contactEmail ?? previous.contactEmail ?? user.email),
        contactPhone: (payload.contactPhone ?? previous.contactPhone ?? null),
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
    const changedFields = computeChangedFields(previous, current, EMPLOYER_PROFILE_FIELDS);
    logger_1.default.info({
        event: 'employer_profile_updated',
        userId: user.id,
        actorId,
        changedFields,
    });
    const updatedAtIso = current.updatedAt ? current.updatedAt.toISOString() : null;
    if (changedFields.length === 0) {
        logger_1.default.info({
            event: 'employer_profile_update_noop',
            userId: user.id,
            actorId,
        });
    }
    if (changedFields.length > 0) {
        try {
            await (0, authEvents_1.publishUserProfileUpdatedEvent)({
                userId: user.id,
                role: 'EMPLOYER',
                changedFields,
                updatedAt: updatedAtIso,
            });
        }
        catch (error) {
            logger_1.default.warn({
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
//# sourceMappingURL=profile.service.js.map