import type { CandidateProfileRequestInput, CandidateProfileResponse, EmployerProfileRequestInput, EmployerProfileResponse } from '../schemas/profile.schema';
export type ProfileFetchResult = {
    role: 'CANDIDATE';
    email: string;
    profile: CandidateProfileResponse;
} | {
    role: 'EMPLOYER';
    email: string;
    profile: EmployerProfileResponse;
};
export declare function getProfileByUserId(userId: string): Promise<ProfileFetchResult>;
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
export declare function upsertCandidateProfile({ userId, actorId, payload, }: UpsertCandidateProfileParams): Promise<UpsertProfileResult>;
export declare function upsertEmployerProfile({ userId, actorId, payload, }: UpsertEmployerProfileParams): Promise<UpsertProfileResult>;
//# sourceMappingURL=profile.service.d.ts.map